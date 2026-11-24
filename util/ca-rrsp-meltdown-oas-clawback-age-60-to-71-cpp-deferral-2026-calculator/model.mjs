// Annual amounts are expressed in constant 2026 Canadian dollars.
const brackets = (...rows) => Object.freeze(rows.map(Object.freeze));
export const FEDERAL_BRACKETS = brackets(
  [58523, .14], [117045, .205], [181440, .26], [258482, .29], [Infinity, .33]
);
export const PROVINCES = Object.freeze({
  ON: Object.freeze({ basic: 12989, brackets: brackets(
    [53891, .0505], [107785, .0915], [150000, .1116], [220000, .1216], [Infinity, .1316]
  ) }),
  BC: Object.freeze({ basic: 13216, brackets: brackets(
    [50363, .056], [100728, .077], [115648, .105], [140430, .1229],
    [190405, .147], [265545, .168], [Infinity, .205]
  ) }),
  AB: Object.freeze({ basic: 22769, brackets: brackets(
    [61200, .08], [154259, .10], [185111, .12], [246813, .13], [370220, .14], [Infinity, .15]
  ) }),
  QC: Object.freeze({ basic: 18952, brackets: brackets(
    [54345, .14], [108680, .19], [132245, .24], [Infinity, .2575]
  ) })
});
export const OAS_THRESHOLD = 95323;
export const TFSA_ANNUAL_ROOM = 7000;
export const DEFAULTS = Object.freeze({
  province: 'ON', startAge: 60, deathAge: 90, rrsp: 1350000, tfsa: 70000, cash: 160000,
  otherIncome: 18000, spending: 45000, cppMonthly: 1100, oasMonthly: 750,
  target: 58523, realReturn: 3, cashReturn: 1.5, carryRoom: 0
});

const RRIF_FACTORS = [
  .0528, .0540, .0553, .0567, .0582, .0598, .0617, .0636, .0658, .0682,
  .0708, .0738, .0771, .0808, .0851, .0899, .0955, .1021, .1099, .1192,
  .1306, .1449, .1634, .1879, .20
];
const positive = value => Math.max(0, value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function rrifFactor(openingAge) {
  return openingAge < 71 ? 1 / (90 - openingAge) : RRIF_FACTORS[Math.min(24, openingAge - 71)];
}

export function cppFactor(startAge) {
  const months = (clamp(startAge, 60, 70) - 65) * 12;
  return 1 + months * (months < 0 ? .006 : .007);
}

export function oasFactor(startAge) {
  return 1 + (clamp(startAge, 65, 70) - 65) * 12 * .006;
}

export function oasRecovery(netIncomeBeforeRepayment, grossOas) {
  return Math.min(grossOas, .15 * positive(netIncomeBeforeRepayment - OAS_THRESHOLD));
}

export function progressiveTax(income, schedule) {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of schedule) {
    tax += (Math.min(income, upper) - lower) * rate;
    if (income <= upper) break;
    lower = upper;
  }
  return positive(tax);
}

function ontarioHealthPremium(income) {
  return clamp((income - 20000) * .06, 0, 300)
    + clamp((income - 36000) * .06, 0, 150)
    + clamp((income - 48000) * .25, 0, 150)
    + clamp((income - 72000) * .25, 0, 150)
    + clamp((income - 200000) * .25, 0, 150);
}

export function incomeTax(taxableIncome, province) {
  const { basic, brackets: schedule } = PROVINCES[province];
  const federalBasic = 16452 - (16452 - 14829) * clamp((taxableIncome - 181440) / (258482 - 181440), 0, 1);
  let federal = positive(progressiveTax(taxableIncome, FEDERAL_BRACKETS) - federalBasic * .14);
  let provincial = positive(progressiveTax(taxableIncome, schedule) - basic * schedule[0][1]);

  if (province === 'QC') federal *= .835;
  if (province === 'BC') provincial = positive(provincial - positive(690 - .0356 * positive(taxableIncome - 25570)));
  if (province === 'ON') {
    provincial += .20 * positive(provincial - 5818) + .36 * positive(provincial - 7446);
    provincial = positive(provincial - positive(600 - provincial)) + ontarioHealthPremium(taxableIncome);
  }
  return federal + provincial;
}

export function estimateTax(grossIncome, grossOas, province) {
  const recovery = oasRecovery(grossIncome, grossOas);
  const taxableIncome = grossIncome - recovery;
  return { taxableIncome, incomeTax: incomeTax(taxableIncome, province), recovery };
}

function validate(inputs, strategy) {
  if (!Object.hasOwn(PROVINCES, inputs.province) || !['meltdown', 'defer'].includes(strategy)) {
    throw new RangeError('Choose a supported province and strategy.');
  }
  const limits = {
    startAge: [60, 70], deathAge: [Math.max(65, inputs.startAge), 100],
    rrsp: [0, 100000000], tfsa: [0, 100000000], cash: [0, 100000000],
    otherIncome: [0, 10000000], spending: [0, 10000000],
    cppMonthly: [0, 10000], oasMonthly: [0, 1000], target: [0, 10000000],
    realReturn: [-50, 25], cashReturn: [-50, 25], carryRoom: [0, 1000000]
  };
  for (const [name, [min, max]] of Object.entries(limits)) {
    const value = inputs[name];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(`${name} must be between ${min} and ${max}.`);
    }
  }
  if (![inputs.startAge, inputs.deathAge].every(Number.isInteger)) throw new RangeError('Enter ages in whole years.');
}

export function simulate(inputs, strategy) {
  validate(inputs, strategy);
  const { startAge, deathAge, cppMonthly, oasMonthly, otherIncome, spending, province } = inputs;
  const proactive = strategy === 'meltdown';
  const pensionAge = proactive ? 70 : 65;
  const cppAnnual = cppMonthly * 12 * cppFactor(pensionAge);
  const oasAnnual = oasMonthly * 12 * oasFactor(pensionAge);
  const growth = 1 + inputs.realReturn / 100;
  const cashGrowth = 1 + inputs.cashReturn / 100;
  let { rrsp: registered, tfsa, cash, carryRoom: tfsaRoom } = inputs;
  let restoreRoom = 0;
  let unfundedSpending = 0;
  let regularIncomeTax = 0;
  let regularRecovery = 0;
  const rows = [];

  for (let age = startAge; age <= deathAge; age++) {
    const openingRegistered = registered;
    // The age label is the age attained during the year, one above the assumed January 1 age.
    const minimum = age >= 72 ? openingRegistered * rrifFactor(age - 1) : 0;
    const cpp = age >= pensionAge ? cppAnnual : 0;
    const oas = age >= pensionAge ? oasAnnual * (age >= 75 ? 1.10 : 1) : 0;
    const baseIncome = otherIncome + cpp + oas;
    const bracketFill = proactive && age <= 70 ? positive(inputs.target - baseIncome) : 0;
    const withdrawal = Math.min(openingRegistered, Math.max(minimum, bracketFill));
    const grossIncome = baseIncome + withdrawal;
    const tax = estimateTax(grossIncome, oas, province);
    const afterTaxIncome = grossIncome - tax.incomeTax - tax.recovery;
    const flow = afterTaxIncome - spending;

    // Registered withdrawals occur at the start of the year before investment growth.
    registered = (openingRegistered - withdrawal) * growth;
    tfsa *= growth;
    cash *= cashGrowth;
    tfsaRoom += TFSA_ANNUAL_ROOM + restoreRoom;
    const cashDraw = Math.min(cash, positive(-flow));
    const tfsaWithdrawal = Math.min(tfsa, positive(-flow - cashDraw));
    const shortfall = positive(-flow - cashDraw - tfsaWithdrawal);
    const tfsaContribution = Math.min(tfsaRoom, positive(flow));
    cash += positive(flow) - tfsaContribution - cashDraw;
    tfsa += tfsaContribution - tfsaWithdrawal;
    tfsaRoom -= tfsaContribution;
    restoreRoom = tfsaWithdrawal;
    unfundedSpending += shortfall;
    regularIncomeTax += tax.incomeTax;
    regularRecovery += tax.recovery;
    rows.push({ age, openingRegistered, minimum, withdrawal, cpp, oas, grossIncome, ...tax,
      afterTaxIncome, registered, tfsa, cash, tfsaRoom, tfsaWithdrawal, tfsaContribution, shortfall });
  }

  const final = rows.at(-1);
  const finalReturn = estimateTax(final.grossIncome + registered, final.oas, province);
  const terminalIncomeTax = finalReturn.incomeTax - final.incomeTax;
  const terminalRecovery = finalReturn.recovery - final.recovery;
  const terminalTax = terminalIncomeTax + terminalRecovery;
  const estate = registered + tfsa + cash - terminalTax;
  return {
    rows, regularIncomeTax, regularRecovery, lifetimeTax: regularIncomeTax + regularRecovery,
    terminalIncomeTax, terminalRecovery, terminalTax, totalRecovery: regularRecovery + terminalRecovery,
    unfundedSpending, estate, netWealth: estate - unfundedSpending
  };
}

export function compare(inputs = DEFAULTS) {
  const meltdown = simulate(inputs, 'meltdown');
  const defer = simulate(inputs, 'defer');
  return {
    meltdown, defer,
    lifetimeTaxSaved: defer.lifetimeTax - meltdown.lifetimeTax,
    terminalTaxSaved: defer.terminalTax - meltdown.terminalTax,
    wealthAdvantage: meltdown.netWealth - defer.netWealth
  };
}
