const FEDERAL_PASSIVE_RATE = 38 + 2 / 3;
export const PROVINCES = Object.freeze({
  ON: Object.freeze({ ordinaryRate: 53.53, eligibleRate: 39.34, corporateRate: FEDERAL_PASSIVE_RATE + 11.5 }),
  BC: Object.freeze({ ordinaryRate: 53.50, eligibleRate: 36.54, corporateRate: FEDERAL_PASSIVE_RATE + 12 }),
  AB: Object.freeze({ ordinaryRate: 48, eligibleRate: 34.31, corporateRate: FEDERAL_PASSIVE_RATE + 8 }),
  QC: Object.freeze({ ordinaryRate: 53.31, eligibleRate: 40.11, corporateRate: FEDERAL_PASSIVE_RATE + 11.5 }),
});

export const DEFAULTS = Object.freeze({
  initial: 100000, addition: 6000, years: 20, totalReturn: 7, yieldRate: 2,
  regularMer: 0.08, swapMer: 0.10, swapFee: 0.30,
  account: 'PERSONAL_NON_REG', province: 'ON', distribution: 'US_FOREIGN_DIV',
  ordinaryRate: null, eligibleRate: null, withholding: 'NONE',
  includeOas: false, otherIncome: 95000, oasBenefit: 9000, otherAaii: 0,
});

const INCLUSION = 0.5;
const PART_IV = (38 + 1 / 3) / 100;
const GROSS_UP = 1.38;
const OAS_THRESHOLD = 95323;
const MAX_YEARS = 30;
const AMOUNT_MAX = 1e9;

export function oasRecovery(baseIncome, newIncome, benefit) {
  const recovery = income => Math.min(benefit, 0.15 * Math.max(0, income - OAS_THRESHOLD));
  return recovery(baseIncome + newIncome) - recovery(baseIncome);
}

export function businessLimit(aaii) {
  return 500000 - Math.min(500000, 5 * Math.max(0, aaii - 50000));
}

function validate(inputs, corporate, eligible, foreign) {
  const bounds = {
    initial: [0, AMOUNT_MAX], addition: [0, AMOUNT_MAX], years: [10, MAX_YEARS],
    totalReturn: [-100, 100], yieldRate: [0, 100],
    regularMer: [0, 100], swapMer: [0, 100], swapFee: [0, 100],
  };
  if (corporate) bounds.otherAaii = [0, AMOUNT_MAX];
  if (!corporate) {
    if (inputs.ordinaryRate !== null) bounds.ordinaryRate = [0, 60];
    if (eligible && inputs.eligibleRate !== null) bounds.eligibleRate = [-15, 60];
    if (inputs.includeOas) {
      bounds.otherIncome = [0, AMOUNT_MAX];
      bounds.oasBenefit = [0, AMOUNT_MAX];
    }
  }
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const value = inputs[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(`${key} must be between ${min} and ${max}.`);
    }
  }
  if (!Number.isInteger(inputs.years)) throw new RangeError('Enter a whole number of years.');
  if (inputs.swapMer + inputs.swapFee > 100) throw new RangeError('Combined swap costs must be 100% or less.');
  if (foreign && !['NONE', 'CREDITED', 'UNCREDITED'].includes(inputs.withholding)) {
    throw new RangeError('Choose a valid U.S. withholding assumption.');
  }
}

function simulateYear(previous, year, costs, rates, inputs) {
  const opening = previous.value;
  const grossValue = Math.max(0, opening * (1 + inputs.totalReturn / 100 - costs.mer));
  const distribution = Math.min(grossValue, opening * costs.yield);
  const taxableDistribution = distribution * rates.distributionIncomeFactor;
  const distributionOas = oasRecovery(inputs.otherIncome, taxableDistribution, rates.oasBenefit);
  const distributionTax = distribution * rates.distributionTax;
  const reinvested = distribution - distributionTax - distributionOas;
  const value = grossValue - distribution + reinvested + inputs.addition;
  const acb = previous.acb + reinvested + inputs.addition;
  const gain = value - acb;
  const taxableGain = Math.max(0, gain) * INCLUSION;
  const saleTax = taxableGain * rates.saleTax;
  const saleOas = oasRecovery(inputs.otherIncome + taxableDistribution, taxableGain, rates.oasBenefit);
  const annualAaii = rates.corporate ? distribution : null;
  const saleAaii = rates.corporate ? taxableGain : null;
  const holdingBusinessLimit = rates.corporate ? businessLimit(inputs.otherAaii + annualAaii) : null;
  const saleBusinessLimit = rates.corporate ? businessLimit(inputs.otherAaii + annualAaii + saleAaii) : null;
  const cdaCredit = rates.corporate ? taxableGain : null;

  return { year, opening, distribution, distributionTax, distributionOas, reinvested, value, acb, gain,
    saleTax, saleOas, net: value - saleTax - saleOas, annualAaii, saleAaii,
    holdingBusinessLimit, saleBusinessLimit, cdaCredit };
}

/** Percentage inputs are percentage points. Wealth is measured inside the chosen account. */
export function calculate(overrides = {}) {
  const inputs = { ...DEFAULTS, ...overrides };
  const province = Object.hasOwn(PROVINCES, inputs.province) ? PROVINCES[inputs.province] : null;
  if (!province) throw new RangeError('Choose a supported province.');
  if (!['PERSONAL_NON_REG', 'CCPC_CORP'].includes(inputs.account)) throw new RangeError('Choose an account type.');
  if (!['US_FOREIGN_DIV', 'CANADIAN_ELIGIBLE_DIV', 'BOND_INTEREST'].includes(inputs.distribution)) {
    throw new RangeError('Choose a distribution type.');
  }
  const corporate = inputs.account === 'CCPC_CORP';
  const eligible = inputs.distribution === 'CANADIAN_ELIGIBLE_DIV';
  const foreign = inputs.distribution === 'US_FOREIGN_DIV';
  validate(inputs, corporate, eligible, foreign);

  const ordinaryRate = corporate ? province.corporateRate : (inputs.ordinaryRate ?? province.ordinaryRate);
  const eligibleRate = corporate ? PART_IV : (inputs.eligibleRate ?? province.eligibleRate) / 100;
  const withholding = foreign && inputs.withholding !== 'NONE' ? 0.15 : 0;
  const credit = inputs.withholding === 'CREDITED' ? Math.min(withholding, ordinaryRate / 100) : 0;
  const rates = {
    corporate,
    distributionTax: eligible ? eligibleRate : ordinaryRate / 100 + withholding - credit,
    distributionIncomeFactor: eligible ? GROSS_UP : 1,
    saleTax: ordinaryRate / 100,
    oasBenefit: !corporate && inputs.includeOas ? inputs.oasBenefit : 0,
  };
  if (!rates.oasBenefit) inputs.otherIncome = 0;

  const regularCosts = { mer: inputs.regularMer / 100, yield: inputs.yieldRate / 100 };
  const swapCosts = { mer: (inputs.swapMer + inputs.swapFee) / 100, yield: 0 };
  const start = { value: inputs.initial, acb: inputs.initial, net: inputs.initial };
  const rows = [{ year: 0, regular: start, swap: { ...start } }];
  let breakeven = null;
  let totalTax = 0;
  let totalOpening = 0;
  let totalAaii = 0;

  for (let year = 1; year <= MAX_YEARS; year++) {
    const previous = rows[year - 1];
    const regular = simulateYear(previous.regular, year, regularCosts, rates, inputs);
    const swap = simulateYear(previous.swap, year, swapCosts, rates, inputs);
    rows.push({ year, regular, swap });
    if (breakeven === null && swap.net - regular.net >= 0.01) breakeven = year;
    if (year > inputs.years) continue;
    totalTax += regular.distributionTax + regular.distributionOas;
    totalOpening += regular.opening;
    totalAaii += regular.annualAaii ?? 0;
  }

  const final = rows[inputs.years];
  return {
    rows: rows.slice(0, inputs.years + 1), final, breakeven,
    advantage: final.swap.net - final.regular.net,
    averageAnnualTax: totalTax / inputs.years,
    averageAnnualTaxRate: totalOpening ? 100 * totalTax / totalOpening : 0,
    averageAnnualAaii: corporate ? totalAaii / inputs.years : null,
  };
}
