export const ANI_LIMIT = 100_000;
export const BUFFER_TARGET = 99_999;

const FULL_ALLOWANCE = 12_570;
const BASIC_LIMIT = 37_700;
const HIGHER_LIMIT = 125_140;
const STARTING_SAVINGS_LIMIT = 5_000;
const DIVIDEND_ALLOWANCE = 500;
const INCOME_RATES = [0.2, 0.4, 0.45];
const DIVIDEND_RATES = [0.1075, 0.3575, 0.3935];
const MAX_INPUT = 10_000_000;
const pennies = amount => Math.round(amount * 100);
const money = amount => pennies(amount) / 100;
const positive = amount => Math.max(0, amount);

export function personalAllowance(ani) {
  return positive(FULL_ALLOWANCE - Math.floor(positive(pennies(ani) - pennies(ANI_LIMIT)) / 200));
}

function bandTax(from, to, basic, higher, rates) {
  return positive(Math.min(to, basic) - from) * rates[0]
    + positive(Math.min(to, higher) - Math.max(from, basic)) * rates[1]
    + positive(to - Math.max(from, higher)) * rates[2];
}

export function incomeTax(employment, savings, dividends, allowance, reliefAtSource = 0) {
  const total = money(positive(employment + savings + dividends - allowance));
  const basic = BASIC_LIMIT + reliefAtSource;
  const higher = HIGHER_LIMIT + reliefAtSource;
  const psa = pennies(total) > pennies(higher) ? 0 : pennies(total) > pennies(basic) ? 500 : 1_000;

  // e is taxable employment and x is taxable employment plus savings.
  const minE = positive(employment - allowance);
  const maxE = Math.min(employment, total);
  const minX = positive(total - dividends);
  const maxX = Math.min(employment + savings, total);
  const minSavings = positive(savings - allowance);
  const maxSavings = Math.min(savings, total);
  const tax = (e, x) => {
    const savingsStart = Math.min(x, Math.max(e, STARTING_SAVINGS_LIMIT) + psa);
    return bandTax(0, e, basic, higher, INCOME_RATES)
      + bandTax(savingsStart, x, basic, higher, INCOME_RATES)
      + bandTax(Math.min(total, x + DIVIDEND_ALLOWANCE), total, basic, higher, DIVIDEND_RATES);
  };
  if (minE === maxE && minX === maxX) return money(tax(minE, minX));

  // Tax is affine between these boundaries. Check their vertices to find the
  // lowest liability over all feasible allocations of the Personal Allowance.
  const eLines = [minE, maxE, STARTING_SAVINGS_LIMIT, basic, higher, basic - psa, higher - psa];
  const xLines = [minX, maxX, basic, higher, STARTING_SAVINGS_LIMIT + psa,
    basic - DIVIDEND_ALLOWANCE, higher - DIVIDEND_ALLOWANCE];
  const diagonals = [minSavings, maxSavings, psa];
  let lowest = Infinity;
  function candidate(e, x) {
    if (pennies(e) < pennies(minE) || pennies(e) > pennies(maxE)
      || pennies(x) < pennies(minX) || pennies(x) > pennies(maxX)
      || pennies(x - e) < pennies(minSavings) || pennies(x - e) > pennies(maxSavings)) return;
    lowest = Math.min(lowest, tax(money(e), money(x)));
  }
  for (const e of eLines) {
    for (const x of xLines) candidate(e, x);
    for (const spread of diagonals) candidate(e, e + spread);
  }
  for (const x of xLines) {
    for (const spread of diagonals) candidate(x - spread, x);
  }
  return money(lowest);
}

export function employeeNI(cashPay) {
  return money(positive(Math.min(cashPay, 50_270) - 12_570) * 0.08
    + positive(cashPay - 50_270) * 0.02);
}

function childcare(passesIncomeTest, inputs) {
  const { under3, universalTwo, age3to4, hourlyRate, tfcChildren, disabledTfc } = inputs;
  const funded = passesIncomeTest && inputs.otherEligible && inputs.fundedEligible;
  const tfc = passesIncomeTest && inputs.otherEligible && inputs.tfcEligible;
  const hours = 38 * (funded ? 30 * (under3 + age3to4) : 15 * (age3to4 + universalTwo));
  return {
    hours,
    fundedValue: money(hours * hourlyRate),
    tfc: tfc ? 2_000 * (tfcChildren + disabledTfc) : 0
  };
}

function projection(inputs, cashPay, extra = 0) {
  const existingSacrifice = inputs.pensionMethod === 'sacrifice' ? inputs.pension : 0;
  const netPayPension = inputs.pensionMethod === 'netPay' ? inputs.pension : 0;
  const reliefAtSource = inputs.pensionMethod === 'relief' ? inputs.pension : 0;
  const niPay = money(cashPay - existingSacrifice - extra);
  const employment = money(niPay + inputs.bik - netPayPension);
  const ani = money(employment + inputs.savings + inputs.dividends - reliefAtSource);
  const allowance = personalAllowance(ani);
  const tax = incomeTax(employment, inputs.savings, inputs.dividends, allowance, reliefAtSource);
  const ni = employeeNI(niPay);
  const spendable = money(niPay + inputs.dividends + inputs.savings - netPayPension
    - reliefAtSource * 0.8 - tax - ni);
  const care = childcare(ani <= ANI_LIMIT, inputs);
  const employerPassBack = inputs.passBack
    ? money(0.15 * Math.min(extra, positive(cashPay - existingSacrifice - 5_000))) : 0;

  return {
    ani, allowance, employment, tax, ni, spendable, ...care, employerPassBack,
    livingStandard: money(spendable + care.fundedValue + care.tfc),
    pensionAdded: money(extra + employerPassBack)
  };
}

function breakEvenSalary(inputs, cashPay, ani) {
  const afterDeductions = money(ani - cashPay);
  const referencePay = money(BUFFER_TARGET - afterDeductions);
  if (referencePay < inputs.pension && inputs.pensionMethod !== 'relief') return null;
  if (referencePay < 0) return null;

  const target = projection(inputs, referencePay).livingStandard;
  const noSacrifice = inputs.pensionMethod === 'sacrifice' ? { ...inputs, pension: 0 } : inputs;
  const incomeOffset = money(afterDeductions + (inputs.pension - noSacrifice.pension));
  const first = Math.max(0, Math.floor(money(ANI_LIMIT - incomeOffset)) + 1);
  const psaCliff = Math.floor(money(HIGHER_LIMIT - incomeOffset));
  const qualifies = salary => projection(noSacrifice, salary).livingStandard >= target;

  // The savings allowance can disappear at the additional-rate boundary.
  // Search each side independently. £2 steps preserve Personal Allowance
  // rounding parity, making take-home monotone within each search.
  const upper = 10 * MAX_INPUT;
  for (const [start, end] of [[first, psaCliff], [Math.max(first, psaCliff + 1), upper]]) {
    const matches = [];
    for (const low of [start, start + 1]) {
      let left = 0;
      let right = Math.floor((end - low) / 2);
      if (right < 0 || !qualifies(low + 2 * right)) continue;
      while (left < right) {
        const middle = Math.floor((left + right) / 2);
        if (qualifies(low + 2 * middle)) right = middle;
        else left = middle + 1;
      }
      matches.push(low + 2 * left);
    }
    if (matches.length) return Math.min(...matches);
  }
  return null;
}

export function calculate({
  salary = 0, bonus = 0, savings = 0, dividends = 0, bik = 0, pension = 0,
  pensionMethod = 'sacrifice', under3 = 0, universalTwo = 0, age3to4 = 0,
  hourlyRate = 7.5, tfcChildren = 0, disabledTfc = 0, otherEligible = true,
  fundedEligible = true, tfcEligible = true, passBack = false
} = {}) {
  for (const value of [salary, bonus, savings, dividends, bik, pension, hourlyRate]) {
    if (!Number.isFinite(value) || value < 0 || value > MAX_INPUT || money(value) !== value) {
      throw new RangeError('Enter non-negative amounts with up to two decimal places.');
    }
  }
  for (const value of [under3, universalTwo, age3to4, tfcChildren, disabledTfc]) {
    if (!Number.isInteger(value) || value < 0 || value > 30) {
      throw new RangeError('Enter whole child counts from 0 to 30.');
    }
  }
  if (universalTwo > under3 || disabledTfc > tfcChildren) {
    throw new RangeError('The qualifying subsets must fit within their corresponding child counts.');
  }
  if (!['sacrifice', 'netPay', 'relief'].includes(pensionMethod)) {
    throw new RangeError('Choose a pension contribution method.');
  }
  const cashPay = money(salary + bonus);
  if (pensionMethod !== 'relief' && pension > cashPay) {
    throw new RangeError('Existing payroll pension contributions cannot exceed salary and bonus.');
  }
  const inputs = {
    savings, dividends, bik, pension, pensionMethod, under3, universalTwo,
    age3to4, hourlyRate, tfcChildren, disabledTfc, otherEligible, fundedEligible, tfcEligible, passBack
  };
  const before = projection(inputs, cashPay);
  const grossIncome = money(cashPay + savings + dividends + bik);
  const required = money(positive(before.ani - ANI_LIMIT));
  const bufferRequired = money(positive(before.ani - BUFFER_TARGET));
  const available = money(cashPay - (pensionMethod === 'relief' ? 0 : pension));
  const after = required <= available ? projection(inputs, cashPay, required) : null;
  const buffered = bufferRequired <= available ? projection(inputs, cashPay, bufferRequired) : null;
  const potentialCare = childcare(true, inputs);
  const lostFunded = money(potentialCare.fundedValue - before.fundedValue);
  const lostTfc = potentialCare.tfc - before.tfc;
  const lostAllowanceTax = money(before.tax - incomeTax(
    before.employment, savings, dividends, FULL_ALLOWANCE, pensionMethod === 'relief' ? pension : 0
  ));
  const livingGain = after ? money(after.livingStandard - before.livingStandard) : null;

  return {
    grossIncome, before, after, buffered, required, bufferRequired, available,
    lostHours: potentialCare.hours - before.hours, lostFunded, lostTfc, lostAllowanceTax,
    cliffLoss: money(lostFunded + lostTfc + lostAllowanceTax), livingGain,
    effectiveReturn: required && after ? 100 * (livingGain + after.pensionAdded) / required : null,
    breakEven: breakEvenSalary(inputs, cashPay, before.ani)
  };
}
