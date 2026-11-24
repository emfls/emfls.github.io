export const TAX_YEAR = 2026;
export const FEDERAL_EXEMPTION = 181440;
export const FEDERAL_AMT_RATE = 0.205;
export const QUEBEC_EXEMPTION = 183680;
export const QUEBEC_AMT_RATE = 0.19;
export const PROVINCIAL_MULTIPLIERS = Object.freeze({ ON: 0.2463, BC: 0.40, AB: 0.35 });
export const MAX_AMOUNT = 1_000_000_000;

const TOP_BRACKET = 258482;
const LOW_RATE = 0.14;
const TOP_RATE = 0.33;
const BRACKETS = [
  [58523, LOW_RATE],
  [117045, 0.205],
  [FEDERAL_EXEMPTION, 0.26],
  [TOP_BRACKET, 0.29],
  [Infinity, TOP_RATE],
];
const CARRYFORWARD_YEARS = 7;
const QUEBEC_ABATEMENT = 0.165;

const positive = value => Math.max(0, value);
const cents = value => Math.round((value + 1e-9) * 100);
const money = value => cents(value) / 100;

function amount(value = 0) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) {
    throw new RangeError('Enter an amount from $0 to $1 billion.');
  }
  return value;
}

export function progressiveFederalTax(taxableIncome) {
  let tax = 0;
  let floor = 0;
  for (const [ceiling, rate] of BRACKETS) {
    tax += positive(Math.min(taxableIncome, ceiling) - floor) * rate;
    if (taxableIncome <= ceiling) break;
    floor = ceiling;
  }
  return money(tax);
}

export function basicPersonalAmount(netIncome) {
  const phaseout = Math.min(1, positive(netIncome - FEDERAL_EXEMPTION) / (TOP_BRACKET - FEDERAL_EXEMPTION));
  return money(16452 - 1623 * phaseout);
}

export function donationCredit(donations, taxableIncome) {
  const aboveFirstTier = positive(donations - 200);
  const topTier = Math.min(aboveFirstTier, positive(taxableIncome - TOP_BRACKET));
  return money(Math.min(200, donations) * LOW_RATE + (aboveFirstTier - topTier) * 0.29 + topTier * TOP_RATE);
}

export function projectCarryforward(pool, annualHeadroom = 0) {
  const poolCents = cents(positive(pool));
  const annualCents = cents(amount(annualHeadroom));
  let remaining = poolCents;
  const years = Array.from({ length: CARRYFORWARD_YEARS }, (_, index) => {
    const claimed = Math.min(remaining, annualCents);
    remaining -= claimed;
    return { year: TAX_YEAR + index + 1, claimed: claimed / 100, remaining: remaining / 100 };
  });
  return {
    pool: poolCents / 100,
    annualHeadroomNeeded: Math.ceil(poolCents / CARRYFORWARD_YEARS) / 100,
    recovered: (poolCents - remaining) / 100,
    unrecovered: remaining / 100,
    years,
  };
}

function ontarioSurtax(base) {
  return 0.20 * positive(base - 5818) + 0.36 * positive(base - 7446);
}

function provincialEstimate(input, federalAmt) {
  const { province, isTrust, quebecAti, quebecMinimumDeduction, quebecRegularTax, ontarioSurtaxBase } = input;
  if (province === 'QC') {
    if (isTrust || [quebecAti, quebecMinimumDeduction, quebecRegularTax].some(value => value == null)) return null;
    const minimum = QUEBEC_AMT_RATE * positive(amount(quebecAti) - QUEBEC_EXEMPTION);
    return money(positive(minimum - amount(quebecMinimumDeduction) - amount(quebecRegularTax)));
  }
  const basic = federalAmt * PROVINCIAL_MULTIPLIERS[province];
  if (province !== 'ON' || isTrust || ontarioSurtaxBase == null) return money(basic);
  const base = amount(ontarioSurtaxBase);
  return money(basic + ontarioSurtax(base + basic) - ontarioSurtax(base));
}

export function calculateAmt(input = {}) {
  const { province = 'ON', isTrust = false } = input;
  if (province !== 'QC' && !Object.hasOwn(PROVINCIAL_MULTIPLIERS, province)) {
    throw new RangeError('Select a supported province.');
  }
  const otherIncome = amount(input.otherIncome);
  const regularCapGains = amount(input.regularCapGains);
  const lcgeCapGains = amount(input.lcgeCapGains);
  const donatedSecuritiesCapGains = amount(input.donatedSecuritiesCapGains);
  const donations = amount(input.donations);
  const restrictedDeductions = amount(input.restrictedDeductions);
  const nonCapitalLoss = amount(input.nonCapitalLoss);
  if (isTrust && lcgeCapGains > 0) throw new RangeError('The LCGE field applies to individuals.');

  const regularNetIncome = positive(otherIncome + 0.50 * (regularCapGains + lcgeCapGains) - restrictedDeductions);
  const regularTaxableIncome = positive(otherIncome + 0.50 * regularCapGains - restrictedDeductions - nonCapitalLoss);
  const grossRegularTax = isTrust ? money(regularTaxableIncome * TOP_RATE) : progressiveFederalTax(regularTaxableIncome);
  const basicPersonalCredit = isTrust ? 0 : money(basicPersonalAmount(regularNetIncome) * LOW_RATE);
  const regularDonationCredit = donationCredit(donations, regularTaxableIncome);
  const regularFederalTax = money(positive(grossRegularTax - basicPersonalCredit - regularDonationCredit));

  const exemption = isTrust ? 0 : FEDERAL_EXEMPTION;
  const amtAdjustedTaxableIncome = positive(otherIncome + regularCapGains + 0.30 * (lcgeCapGains + donatedSecuritiesCapGains)
    - 0.50 * (restrictedDeductions + nonCapitalLoss));
  const amtTaxableBase = positive(amtAdjustedTaxableIncome - exemption);
  const grossFederalAmt = money(amtTaxableBase * FEDERAL_AMT_RATE);
  const amtDonationCredit = money(0.80 * regularDonationCredit);
  const amtBasicPersonalCredit = money(0.50 * basicPersonalCredit);
  const netFederalAmt = money(positive(grossFederalAmt - amtDonationCredit - amtBasicPersonalCredit));
  const additionalFederalAmt = money(positive(netFederalAmt - regularFederalTax));

  const provincialAmt = provincialEstimate({ ...input, province, isTrust }, additionalFederalAmt);
  const federalCashImpact = money(additionalFederalAmt * (province === 'QC' ? 1 - QUEBEC_ABATEMENT : 1));
  const totalAdditionalAmtPayable = provincialAmt === null ? null : money(federalCashImpact + provincialAmt);

  return {
    regularNetIncome, regularTaxableIncome, grossRegularTax, basicPersonalCredit, regularDonationCredit, regularFederalTax,
    exemption, amtAdjustedTaxableIncome, amtTaxableBase, grossFederalAmt, amtDonationCredit, amtBasicPersonalCredit,
    netFederalAmt, additionalFederalAmt, federalCashImpact, provincialAmt, totalAdditionalAmtPayable,
    carryforward: projectCarryforward(additionalFederalAmt, input.annualHeadroom),
  };
}
