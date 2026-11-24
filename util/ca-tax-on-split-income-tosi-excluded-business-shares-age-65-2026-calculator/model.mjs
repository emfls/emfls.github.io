const FEDERAL = [[58523, .14], [117045, .205], [181440, .26], [258482, .29], [Infinity, .33]];
const PROVINCES = {
  ON: { brackets: [[53891, .0505], [107785, .0915], [150000, .1116], [220000, .1216], [Infinity, .1316]],
    personalAmount: 12989, credits: [.029863, .10], splitRate: .1316 * 1.56 },
  BC: { brackets: [[50363, .056], [100728, .077], [115648, .105], [140430, .1229],
    [190405, .147], [265545, .168], [Infinity, .205]], personalAmount: 13216, credits: [.0196, .12] },
  AB: { brackets: [[61200, .08], [154259, .10], [185111, .12], [246813, .13],
    [370220, .14], [Infinity, .15]], personalAmount: 22769, credits: [.0218, .0812] },
  QC: { brackets: [[54345, .14], [108680, .19], [132245, .24], [Infinity, .2575]],
    personalAmount: 18952, credits: [.0342, .117], federalMultiplier: .835 },
  SK: { brackets: [[54532, .105], [155805, .125], [Infinity, .145]],
    personalAmount: 20381, credits: [.02519, .11] },
};
const DIVIDENDS = {
  non_eligible_small_business: { index: 0, grossUp: 1.15, federalCredit: .090301 },
  eligible: { index: 1, grossUp: 1.38, federalCredit: .150198 },
};
const MAX_AMOUNT = 100_000_000;

export function federalPersonalAmount(netIncome) {
  const phaseOut = Math.min(1, Math.max(0, (netIncome - 181440) / (258482 - 181440)));
  return 16452 - 1623 * phaseOut;
}

function bracketTax(income, brackets) {
  let tax = 0;
  let previous = 0;
  for (const [limit, rate] of brackets) {
    tax += (Math.min(income, limit) - previous) * rate;
    if (income <= limit) break;
    previous = limit;
  }
  return tax;
}

function ontarioHealthPremium(income) {
  const thresholds = [[200000, 750, .25, 900], [72000, 600, .25, 750],
    [48000, 450, .25, 600], [36000, 300, .06, 450], [20000, 0, .06, 300]];
  const band = thresholds.find(([start]) => income > start);
  if (!band) return 0;
  const [start, base, rate, cap] = band;
  return Math.min(cap, base + (income - start) * rate);
}

function normalTax(provinceCode, otherIncome, taxablePayment, federalCredit = 0, provincialCredit = 0) {
  const province = PROVINCES[provinceCode];
  const income = otherIncome + taxablePayment;
  const federalTax = Math.max(0, bracketTax(income, FEDERAL) - .14 * federalPersonalAmount(income) - federalCredit)
    * (province.federalMultiplier ?? 1);
  const basicProvincialTax = Math.max(0, bracketTax(income, province.brackets)
    - province.personalAmount * province.brackets[0][1]);
  if (provinceCode === 'ON') {
    const surtax = .20 * Math.max(0, basicProvincialTax - 5818) + .36 * Math.max(0, basicProvincialTax - 7446);
    const beforeReduction = basicProvincialTax + surtax;
    const reduction = Math.min(beforeReduction, Math.max(0, 600 - beforeReduction));
    return federalTax + Math.max(0, beforeReduction - reduction - provincialCredit) + ontarioHealthPremium(income);
  }
  const reduction = provinceCode === 'BC' ? Math.max(0, 690 - .0356 * Math.max(0, income - 25570)) : 0;
  return federalTax + Math.max(0, basicProvincialTax - reduction - provincialCredit);
}

function validate(input) {
  if (!Object.hasOwn(PROVINCES, input.province) || !Object.hasOwn(DIVIDENDS, input.dividendType)) {
    throw new RangeError('Choose a supported province and dividend type.');
  }
  const limits = [
    ['dividend', 'Planned dividend', MAX_AMOUNT], ['otherIncome', 'Other taxable income', MAX_AMOUNT],
    ['age', 'Recipient age', 130, true], ['hours', 'Average weekly hours', 168],
    ['votes', 'Voting ownership', 100], ['value', 'Ownership by value', 100],
    ['services', 'Service income share', 100], ['spouseAge', 'Owner spouse age', 130, true],
  ];
  for (const [field, label, max, whole] of limits) {
    const amount = input[field];
    if (!Number.isFinite(amount) || amount < 0 || amount > max || (whole && !Number.isInteger(amount))) {
      throw new RangeError(`${label} must be ${whole ? 'a whole number' : 'a number'} from 0 to ${max}.`);
    }
  }
  for (const field of ['currentActive', 'priorActive', 'direct', 'professional', 'relatedIncomeTest', 'spouseWouldBeExcluded']) {
    if (typeof input[field] !== 'boolean') throw new TypeError(`Expected a yes or no answer for ${field}.`);
  }
}

function dividendGates(input) {
  const businessFailures = [];
  if (input.age < 18) businessFailures.push('Recipient must turn 18 by year-end.');
  let businessBasis = '';
  if (input.hours >= 20) businessBasis = '20-hour rule in 2026';
  else if (input.currentActive) businessBasis = 'Regular, continuous and substantial activity in 2026';
  else if (input.priorActive) businessBasis = 'Active in any five prior tax years';
  else businessFailures.push('Fewer than 20 hours per week and no qualifying current or prior activity confirmed.');

  const shareFailures = [];
  if (input.age < 25) shareFailures.push('Recipient must turn 25 by year-end.');
  if (!input.direct) shareFailures.push('Recipient must own the dividend-paying shares directly.');
  if (input.votes < 10) shareFailures.push('Voting ownership is below 10%.');
  if (input.value < 10) shareFailures.push('Ownership by fair market value is below 10%.');
  if (input.professional) shareFailures.push('The payer is a professional corporation.');
  if (input.services >= 90) shareFailures.push('Services account for at least 90% of business income.');
  if (!input.relatedIncomeTest) shareFailures.push('The separate related-business income test is unconfirmed or unmet.');

  const spouseFailures = [];
  if (input.spouseAge === 0) spouseFailures.push('No qualifying owner spouse or common-law partner entered.');
  else if (input.spouseAge < 65) spouseFailures.push('The owner spouse or partner must turn 65 by year-end.');
  if (input.spouseAge > 0 && !input.spouseWouldBeExcluded) {
    spouseFailures.push('The same amount must qualify as an excluded amount in the owner’s hands.');
  }
  return [
    { name: 'Excluded business', failures: businessFailures, basis: businessBasis },
    { name: 'Excluded shares', failures: shareFailures, basis: 'All excluded-share conditions met' },
    { name: 'Age 65+ spouse exception', failures: spouseFailures, basis: 'The amount would be excluded for the owner' },
  ];
}

function roundMoney(amount) {
  const sign = amount < 0 ? -1 : 1;
  return sign * Math.round((Math.abs(amount) + 1e-9) * 100) / 100 || 0;
}

export function calculateTosi(input) {
  validate(input);
  const { province: code, dividendType, dividend, otherIncome } = input;
  const province = PROVINCES[code];
  const type = DIVIDENDS[dividendType];
  const gates = dividendGates(input);
  const qualifyingGates = gates.filter(gate => gate.failures.length === 0);
  const taxableDividend = dividend * type.grossUp;
  const provincialCreditRate = province.credits[type.index];
  const federalMultiplier = province.federalMultiplier ?? 1;
  const provincialTopRate = province.splitRate ?? province.brackets.at(-1)[1];
  const tosiRate = Math.round(10000 * type.grossUp *
    ((.33 - type.federalCredit) * federalMultiplier + provincialTopRate - provincialCreditRate)) / 10000;
  const baseTax = normalTax(code, otherIncome, 0);
  const exemptTax = normalTax(code, otherIncome, taxableDividend, taxableDividend * type.federalCredit,
    taxableDividend * provincialCreditRate) - baseTax;
  const tosiTax = roundMoney(dividend * tosiRate);
  const roundedExemptTax = roundMoney(exemptTax);

  return {
    status: qualifyingGates.length ? 'TOSI_EXEMPT' : 'CAUGHT_BY_TOSI',
    gates, qualifyingGates,
    tosiTax, exemptTax: roundedExemptTax,
    savings: roundMoney(tosiTax - roundedExemptTax),
    tosiRate,
    exemptRate: dividend > 0 ? exemptTax / dividend : null,
    salaryTax: roundMoney(normalTax(code, otherIncome, dividend) - baseTax),
  };
}
