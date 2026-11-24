const federalBrackets = [[0, .14], [58523, .205], [117045, .26], [181440, .29], [258482, .33]];
const provinces = {
  ON: { basic: 12989, brackets: [[0, .0505], [53891, .0915], [107785, .1116], [150000, .1216], [220000, .1316]] },
  BC: { basic: 13216, brackets: [[0, .056], [50363, .077], [100728, .105], [115648, .1229], [140430, .147], [190405, .168], [265545, .205]] },
  AB: { basic: 22769, brackets: [[0, .08], [61200, .10], [154259, .12], [185111, .13], [246813, .14], [370220, .15]] },
  QC: { basic: 18952, brackets: [[0, .14], [54345, .19], [108680, .24], [132245, .2575]] },
};

const positive = amount => Math.max(0, amount);
const federalFactor = province => province === 'QC' ? .835 : 1;

function bracketTax(income, brackets) {
  return brackets.reduce((total, [floor, rate], index) => {
    const ceiling = brackets[index + 1]?.[0] ?? Infinity;
    return total + positive(Math.min(ceiling, income) - floor) * rate;
  }, 0);
}

function federalBeforeGift(income, netIncome) {
  const phaseout = Math.min(1, positive(netIncome - 181440) / (258482 - 181440));
  return positive(bracketTax(income, federalBrackets) - .14 * (16452 - (16452 - 14829) * phaseout));
}

function provincialBeforeSurtax(income, province) {
  const { basic, brackets } = provinces[province];
  return positive(bracketTax(income, brackets) - basic * brackets[0][1]);
}

function provincialAfterCredit(basicTax, province) {
  if (province !== 'ON') return basicTax;
  const withSurtax = basicTax + .20 * positive(basicTax - 5818) + .36 * positive(basicTax - 7446);
  return positive(withSurtax - positive(600 - withSurtax));
}

function tieredCredit(amount, income, firstRate, standardRate, topRate, threshold) {
  const excess = positive(amount - 200);
  const top = Math.min(excess, positive(income - threshold));
  return Math.min(200, amount) * firstRate + (excess - top) * standardRate + top * topRate;
}

function donationCredit(amount, income, netIncome, province) {
  const claim = Math.min(amount, .75 * netIncome);
  const federal = tieredCredit(claim, income, .14, .29, .33, 258482);
  let provincial;
  switch (province) {
    case 'ON': provincial = tieredCredit(claim, income, .0505, .1116, 0, Infinity); break;
    case 'BC': provincial = tieredCredit(claim, income, .056, .168, .205, 265545); break;
    case 'AB': provincial = tieredCredit(claim, income, .60, .21, 0, Infinity); break;
    case 'QC': provincial = tieredCredit(amount, income, .20, .24, .2575, 132245); break;
  }
  const provincialTax = provincialBeforeSurtax(income, province);
  const provincialSavings = provincialAfterCredit(provincialTax, province) -
    provincialAfterCredit(positive(provincialTax - provincial), province);
  const federalSavings = Math.min(federal, federalBeforeGift(income, netIncome)) * federalFactor(province);
  const total = federalSavings + provincialSavings;
  return {
    claim,
    overFederalLimit: amount - claim,
    federal,
    federalSavings,
    provincial,
    provincialSavings,
    total,
    effectiveRate: amount === 0 ? 0 : total / amount,
  };
}

function regularTax(income, netIncome, province) {
  return federalBeforeGift(income, netIncome) * federalFactor(province) +
    provincialAfterCredit(provincialBeforeSurtax(income, province), province);
}

function scenario(receipt, saleTax, costBeforeCredit, income, netIncome, province) {
  const credit = donationCredit(receipt, income, netIncome, province);
  return { receipt, saleTax, cost: costBeforeCredit - credit.total, ...credit };
}

export function calculateDonation({ fmv, acb, taxableIncome, netIncome = taxableIncome, province }) {
  if (![fmv, acb, taxableIncome, netIncome].every(value => Number.isFinite(value) && value >= 0 && value <= 1e9)) {
    throw new RangeError('Enter amounts from $0 to $1 billion.');
  }
  if (netIncome < taxableIncome) throw new RangeError('Net income must be at least taxable income.');
  if (!Object.hasOwn(provinces, province)) throw new RangeError('Select a supported province.');

  const gain = positive(fmv - acb);
  const taxableGain = gain * .5;
  const saleIncome = taxableIncome + taxableGain;
  const saleNetIncome = netIncome + taxableGain;
  const saleTax = regularTax(saleIncome, saleNetIncome, province) - regularTax(taxableIncome, netIncome, province);
  const netCash = scenario(fmv - saleTax, saleTax, fmv, saleIncome, saleNetIncome, province);
  const fullCash = scenario(fmv, saleTax, fmv + saleTax, saleIncome, saleNetIncome, province);
  const inKind = scenario(fmv, 0, fmv, taxableIncome, netIncome, province);

  const split = donationCredit(fmv / 2, taxableIncome, netIncome, province);
  // Hold Québec provincial claims fixed in this illustrative federal pooling comparison.
  const pooledSavings = province === 'QC' ? inKind.federalSavings : inKind.total;
  const splitSavings = province === 'QC' ? split.federalSavings : split.total;

  const amtInclusion = gain * .3;
  const amtIncomeProxy = taxableIncome + amtInclusion;
  const grossAmt = positive(amtIncomeProxy - 181440) * .205;
  const grossAmtWithoutGiftGain = positive(taxableIncome - 181440) * .205;

  return {
    gain, taxableGain, inKind, netCash, fullCash,
    avoidedSaleTax: saleTax,
    extraSavingsVsNetCash: netCash.cost - inKind.cost,
    extraSavingsVsFullCash: fullCash.cost - inKind.cost,
    poolingDifference: pooledSavings - 2 * splitSavings,
    amt: {
      inclusion: amtInclusion,
      incomeProxy: amtIncomeProxy,
      gross: grossAmt,
      grossIncrease: grossAmt - grossAmtWithoutGiftGain,
      aboveExemption: amtIncomeProxy > 181440,
    },
  };
}
