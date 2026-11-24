const giftBands = Object.freeze([
  Object.freeze({ years: 7, rate: 0 }),
  Object.freeze({ years: 6, rate: .08 }),
  Object.freeze({ years: 5, rate: .16 }),
  Object.freeze({ years: 4, rate: .24 }),
  Object.freeze({ years: 3, rate: .32 }),
  Object.freeze({ years: 0, rate: .40 }),
]);

export const PARAMETERS = Object.freeze({
  nrb: 325000,
  rnrb: 175000,
  taperThreshold: 2000000,
  standardRate: .40,
  charityRate: .36,
  charityMinimumPercent: 10,
  giftBands,
  maxMoney: 100000000000,
});

function nonnegative(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function pence(value) {
  const bounded = Math.min(nonnegative(value), PARAMETERS.maxMoney);
  return Math.round(Number(bounded.toFixed(2)) * 100);
}

function pounds(value) {
  return value / 100;
}

function transferredBand(base, percent) {
  return base * 100 + Math.round(base * Math.min(100, nonnegative(percent)));
}

// Inputs are pounds. Money arithmetic uses pence, with half-pence retained
// for the residence taper and tax rounded to the nearest penny per liability.
export function calculateIht(input) {
  const {
    grossEstate, debts, spouseGift, charityGift, homeNetValue, qualifyingResidence,
    transferNrbPercent, transferRnrbPercent, gifts,
  } = input ?? {};

  const gross = pence(grossEstate);
  const debt = pence(debts);
  const net = Math.max(0, gross - debt);
  const spouse = Math.min(net, pence(spouseGift));
  const charity = Math.min(net - spouse, pence(charityGift));
  const home = qualifyingResidence === true ? Math.min(net - spouse - charity, pence(homeNetValue)) : 0;

  const nrb = transferredBand(PARAMETERS.nrb, transferNrbPercent);
  const rnrbMaximum = transferredBand(PARAMETERS.rnrb, transferRnrbPercent);
  const rnrbTaper = Math.min(rnrbMaximum, Math.max(0, (net - PARAMETERS.taperThreshold * 100) / 2));
  const rnrb = Math.min(home, rnrbMaximum - rnrbTaper);

  const entries = (Array.isArray(gifts) ? gifts.slice(0, 3) : [])
    .map((gift, index) => ({ number: index + 1, amount: pence(gift?.amount), years: nonnegative(gift?.years) }))
    .filter(gift => gift.amount > 0)
    .sort((first, second) => second.years - first.years);

  let availableNrb = nrb;
  let failedGiftValue = 0;
  let giftTax = 0;
  let giftTaperSaved = 0;
  const giftBreakdown = entries.map(({ number, amount, years }) => {
    const { rate } = PARAMETERS.giftBands.find(band => years >= band.years);
    const exempt = rate === 0;
    const nrbUsed = exempt ? 0 : Math.min(availableNrb, amount);
    const taxable = exempt ? 0 : amount - nrbUsed;
    const tax = Math.round(taxable * rate);
    const saved = Math.round(taxable * PARAMETERS.standardRate) - tax;
    if (!exempt) failedGiftValue += amount;
    availableNrb -= nrbUsed;
    giftTax += tax;
    giftTaperSaved += saved;
    return {
      number, years, rate, exempt,
      amount: pounds(amount), nrbUsed: pounds(nrbUsed), taxable: pounds(taxable),
      tax: pounds(tax), taperSaved: pounds(saved),
    };
  });

  // HMRC IHTM45009, for one estate component. The baseline includes the charity
  // legacy and ignores RNRB, but uses the NRB remaining after failed PETs.
  const baseline = Math.max(0, net - spouse - availableNrb);
  const charityTarget = Math.ceil(baseline * PARAMETERS.charityMinimumPercent / 100);
  const charityExtra = Math.max(0, charityTarget - charity);
  const estateRate = baseline > 0 && charityExtra === 0 ? PARAMETERS.charityRate : PARAMETERS.standardRate;
  const taxableEstate = Math.max(0, baseline - charity - rnrb);
  const estateTax = Math.round(taxableEstate * estateRate);
  const totalTax = estateTax + giftTax;
  const netInheritance = net - spouse - charity - estateTax;

  // Compare the residue at the threshold, holding the spouse legacy and the
  // qualifying home share constant. Only other assets can fund the increase.
  const charityTargetFeasible = charityExtra <= net - spouse - charity - home;
  const taxAtThreshold = Math.round(Math.max(0, taxableEstate - charityExtra) * PARAMETERS.charityRate);
  const heirsDeltaAtThreshold = charityTargetFeasible && charityExtra > 0
    ? estateTax - taxAtThreshold - charityExtra
    : charityTargetFeasible ? 0 : null;

  const effectiveBase = net + failedGiftValue;
  return {
    grossEstate: pounds(gross), debts: pounds(debt), netEstate: pounds(net),
    spouseGift: pounds(spouse), charityGift: pounds(charity), qualifyingHome: pounds(home),
    nrb: pounds(nrb), availableNrb: pounds(availableNrb), rnrbMaximum: pounds(rnrbMaximum),
    rnrbTaper: pounds(rnrbTaper), rnrb: pounds(rnrb),
    taxableEstate: pounds(taxableEstate), giftTax: pounds(giftTax),
    giftTaperSaved: pounds(giftTaperSaved), giftBreakdown,
    estateTax: pounds(estateTax), estateRate, totalTax: pounds(totalTax),
    effectiveRate: effectiveBase ? totalTax / effectiveBase : 0,
    netInheritance: pounds(netInheritance),
    charityBaseline: pounds(baseline), charityTarget: pounds(charityTarget), charityExtra: pounds(charityExtra),
    charityTargetFeasible, heirsDeltaAtThreshold: heirsDeltaAtThreshold === null ? null : pounds(heirsDeltaAtThreshold),
  };
}
