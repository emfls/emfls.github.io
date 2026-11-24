const FEDERAL = [[58_523, .14], [117_045, .205], [181_440, .26], [258_482, .29], [Infinity, .33]];
const PROVINCIAL = {
  ON: [[53_891, .0505], [107_785, .0915], [150_000, .1116], [220_000, .1216], [Infinity, .1316]],
  BC: [[50_363, .056], [100_728, .077], [115_648, .105], [140_430, .1229], [190_405, .147], [265_545, .168], [Infinity, .205]],
  AB: [[61_200, .08], [154_259, .10], [185_111, .12], [246_813, .13], [370_220, .14], [Infinity, .15]],
  QC: [[54_345, .14], [108_680, .19], [132_245, .24], [Infinity, .2575]]
};
const BASIC_AMOUNTS = { ON: 12_989, BC: 13_216, AB: 22_769, QC: 18_952 };
const ALBERTA_GRANT = [[10_000, 35], [25_000, 135], [125_000, 275], [250_000, 400], [Infinity, 525]];
const ON_HEALTH_PREMIUM = [
  [20_000, 0, 300, .06], [36_000, 300, 450, .06], [48_000, 450, 600, .25],
  [72_000, 600, 750, .25], [200_000, 750, 900, .25]
];

function checkProvince(province) {
  if (!Object.hasOwn(PROVINCIAL, province)) throw new RangeError('Choose a supported province.');
}

function checkAmount(value) {
  if (!Number.isFinite(value) || value < 0 || value > 10_000_000_000) {
    throw new RangeError('Enter a non-negative dollar amount within the calculator range.');
  }
}

function cents(value) {
  checkAmount(value);
  const rounded = Math.round(value * 100);
  if (Math.abs(value - rounded / 100) > 0.00000001) {
    throw new RangeError('Enter dollar amounts to the nearest cent.');
  }
  return rounded;
}

// A standard grant or Québec court verification, if required.
export function probateFee(province, value, notarial = true) {
  checkProvince(province);
  const amount = cents(value);
  if (province === 'ON') return 15 * Math.ceil(Math.max(0, amount - 5_000_000) / 100_000);
  if (province === 'BC') {
    if (amount <= 2_500_000) return 0;
    const middle = Math.min(amount, 5_000_000) - 2_500_000;
    return 200 + 6 * Math.ceil(middle / 100_000) + 14 * Math.ceil(Math.max(0, amount - 5_000_000) / 100_000);
  }
  if (province === 'AB') return ALBERTA_GRANT.find(([limit]) => amount <= limit * 100)[1];
  return notarial ? 0 : 241;
}

function bracketTax(income, brackets) {
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of brackets) {
    tax += (Math.min(income, upper) - lower) * rate;
    if (income <= upper) break;
    lower = upper;
  }
  return tax;
}

function ontarioHealthPremium(income) {
  let premium = 0;
  for (const [threshold, start, cap, rate] of ON_HEALTH_PREMIUM) {
    if (income <= threshold) break;
    premium = Math.min(cap, start + (income - threshold) * rate);
  }
  return premium;
}

export function incomeTax(province, income) {
  checkProvince(province);
  checkAmount(income);
  const federalPhaseout = Math.min(1, Math.max(0, (income - 181_440) / 77_042));
  const federalBasicAmount = 16_452 - 1_623 * federalPhaseout;
  const federal = Math.max(0, bracketTax(income, FEDERAL) - federalBasicAmount * .14);
  const brackets = PROVINCIAL[province];
  const provincial = Math.max(0, bracketTax(income, brackets) - BASIC_AMOUNTS[province] * brackets[0][1]);
  if (province === 'ON') {
    const surtax = .20 * Math.max(0, provincial - 5_818) + .36 * Math.max(0, provincial - 7_446);
    const beforeReduction = provincial + surtax;
    const reduction = Math.max(0, 600 - beforeReduction);
    return federal + Math.max(0, beforeReduction - reduction) + ontarioHealthPremium(income);
  }
  if (province === 'BC') {
    const reduction = Math.max(0, 690 - .0356 * Math.max(0, income - 25_570));
    return federal + Math.max(0, provincial - reduction);
  }
  return federal * (province === 'QC' ? .835 : 1) + provincial;
}

export function estimateEstate({
  province, rrspRrifFmv = 0, tfsaFmv = 0, nonRegFmv = 0, nonRegAcb = 0,
  homeFmv = 0, homeAcb = 0, otherAssets = 0, jointBypass = 0, otherYtdIncome = 0,
  rrspBypass = false, tfsaBypass = false, notarial = true,
  principalResidenceExempt = true, spousalRollover = false
}) {
  const joint = cents(jointBypass);
  const jointEligible = cents(nonRegFmv) + cents(homeFmv) + cents(otherAssets);
  if (joint > jointEligible) {
    throw new RangeError('Joint survivorship value cannot exceed the home, non-registered and other assets combined.');
  }

  const rrsp = cents(rrspRrifFmv);
  const tfsa = cents(tfsaFmv);
  const gross = jointEligible + rrsp + tfsa;
  const named = (rrspBypass ? rrsp : 0) + (tfsaBypass ? tfsa : 0);
  const probateValue = (gross - joint - named) / 100;
  // A zero routed estate assumes no grant outside Québec.
  const feeFor = value => probateFee(province, value, notarial) * Number(value > 0 || province === 'QC');
  const fee = feeFor(probateValue);
  const namedBeneficiarySavings = feeFor((gross - joint) / 100) - fee;

  const grossCapGain = Math.max(0, cents(nonRegFmv) - cents(nonRegAcb)) / 100;
  const grossHomeGain = Math.max(0, cents(homeFmv) - cents(homeAcb)) / 100;
  const taxableCapitalGain = spousalRollover ? 0 : .50 * (grossCapGain + (principalResidenceExempt ? 0 : grossHomeGain));
  const rrspTaxableInclusion = spousalRollover ? 0 : rrsp / 100;
  const baseline = cents(otherYtdIncome) / 100;
  const withGains = incomeTax(province, baseline + taxableCapitalGain);
  const capitalGainsTax = withGains - incomeTax(province, baseline);
  const rrspTax = incomeTax(province, baseline + taxableCapitalGain + rrspTaxableInclusion) - withGains;
  const terminalTax = capitalGainsTax + rrspTax;
  const totalShrinkage = fee + terminalTax;
  const grossEstate = gross / 100;
  return {
    grossEstate, probateValue, probateFee: fee, namedBeneficiarySavings,
    rrspTaxableInclusion, grossCapGain, taxableCapitalGain, capitalGainsTax, rrspTax, terminalTax,
    totalShrinkage, shrinkageRate: gross ? totalShrinkage / grossEstate : null,
    netEstate: grossEstate - totalShrinkage
  };
}
