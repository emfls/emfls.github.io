const FEDERAL_BANDS = [
  [58523, .14], [117045, .205], [181440, .26], [258482, .29], [Infinity, .33],
];

const PROVINCES = {
  ON: {
    basicAmount: 12989,
    bands: [[53891, .0505], [107785, .0915], [150000, .1116], [220000, .1216], [Infinity, .1316]],
    eligibleCredit: .10,
    nonEligibleCredit: .029863,
  },
  BC: {
    basicAmount: 13216,
    bands: [[50363, .056], [100728, .077], [115648, .105], [140430, .1229], [190405, .147], [265545, .168], [Infinity, .205]],
    eligibleCredit: .12,
    nonEligibleCredit: .0196,
  },
  AB: {
    basicAmount: 22769,
    bands: [[61200, .08], [154259, .10], [185111, .12], [246813, .13], [370220, .14], [Infinity, .15]],
    eligibleCredit: .0812,
    nonEligibleCredit: .0218,
  },
};

export const OAS_THRESHOLD = 95323;
export const OAS_RECOVERY_RATE = .15;

function bracketTax(income, bands) {
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of bands) {
    tax += (Math.min(income, upper) - lower) * rate;
    if (income <= upper) break;
    lower = upper;
  }
  return tax;
}

export function federalBracketTax(taxableIncome) {
  return bracketTax(taxableIncome, FEDERAL_BANDS);
}

export function federalBasicPersonalAmount(netIncome) {
  const phaseOut = Math.min(1, Math.max(0, (netIncome - 181440) / (258482 - 181440)));
  return 16452 - (16452 - 14829) * phaseOut;
}

export function ontarioSurtax(basicProvincialTax) {
  return .20 * Math.max(0, basicProvincialTax - 5818)
    + .36 * Math.max(0, basicProvincialTax - 7446);
}

export function ontarioHealthPremium(taxableIncome) {
  const ramps = [[20000, .06, 300], [36000, .06, 150], [48000, .25, 150],
    [72000, .25, 150], [200000, .25, 150]];
  return ramps.reduce((premium, [start, rate, cap]) =>
    premium + Math.min(cap, Math.max(0, taxableIncome - start) * rate), 0);
}

export function oasRecovery(preRecoveryIncome, oasReceived) {
  return Math.min(oasReceived, Math.max(0, preRecoveryIncome - OAS_THRESHOLD) * OAS_RECOVERY_RATE);
}

function annualLiability(preRecoveryIncome, province, oasReceived, federalCredit = 0, provincialCredit = 0) {
  const recovery = oasRecovery(preRecoveryIncome, oasReceived);
  // In this model line 23500 is the only deduction between line 23400 and line 23600.
  const netIncome = preRecoveryIncome - recovery;
  const taxableIncome = netIncome;
  const federalTax = Math.max(0, federalBracketTax(taxableIncome)
    - federalBasicPersonalAmount(netIncome) * FEDERAL_BANDS[0][1] - federalCredit);
  const { bands, basicAmount } = PROVINCES[province];
  const basicProvincialTax = Math.max(0, bracketTax(taxableIncome, bands) - basicAmount * bands[0][1]);
  // ON428 applies surtax before the Ontario dividend credit and basic tax reduction.
  const surtax = province === 'ON' ? ontarioSurtax(basicProvincialTax) : 0;
  const beforeReduction = Math.max(0, basicProvincialTax + surtax - provincialCredit);
  let reduction = 0;
  if (province === 'ON') reduction = Math.max(0, 600 - beforeReduction);
  if (province === 'BC') reduction = Math.max(0, 690 - .0356 * Math.max(0, netIncome - 25570));
  const healthPremium = province === 'ON' ? ontarioHealthPremium(taxableIncome) : 0;
  const provincialTax = Math.max(0, beforeReduction - reduction) + healthPremium;
  return {
    preRecoveryIncome, recovery, netIncome, taxableIncome, federalTax, provincialTax, surtax,
    healthPremium, totalPayable: federalTax + provincialTax + recovery,
  };
}

export function compareInvestmentIncome({
  province, otherTaxableIncome, investmentCash, receivingOas = false, oasReceived = 0,
}) {
  if (!Object.hasOwn(PROVINCES, province)
    || ![otherTaxableIncome, investmentCash, oasReceived].every(amount =>
      Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000_000)
    || typeof receivingOas !== 'boolean'
    || (receivingOas && oasReceived > otherTaxableIncome)) {
    throw new RangeError('Enter valid amounts and include gross OAS in other income when receiving OAS.');
  }

  const pension = receivingOas ? oasReceived : 0;
  const baseline = annualLiability(otherTaxableIncome, province, pension);
  const { eligibleCredit, nonEligibleCredit } = PROVINCES[province];
  const treatments = [
    ['eligible', 138, .150198, eligibleCredit],
    ['nonEligible', 115, .090301, nonEligibleCredit],
    ['capitalGains', 50, 0, 0],
    ['interest', 100, 0, 0],
  ];
  const scenarios = Object.fromEntries(treatments.map(([type, inclusionPercent, federalDtc, provincialDtc]) => {
    const includedIncome = investmentCash * inclusionPercent / 100;
    const federalCredit = includedIncome * federalDtc;
    const provincialCredit = includedIncome * provincialDtc;
    const annual = annualLiability(otherTaxableIncome + includedIncome, province, pension, federalCredit, provincialCredit);
    const netTax = annual.totalPayable - baseline.totalPayable;
    return [type, {
      ...annual, includedIncome, federalCredit, provincialCredit, netTax,
      additionalRecovery: annual.recovery - baseline.recovery,
      effectiveTaxRate: investmentCash === 0 ? null : netTax / investmentCash,
      afterTaxCash: investmentCash - netTax,
    }];
  }));
  return { baseline, scenarios };
}
