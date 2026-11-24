export const PLANS = Object.freeze({
  '1': Object.freeze({ name: 'Plan 1', annualThreshold: 26900, monthlyThresholdPence: 224166, rate: 9, years: 25, maxYears: 40, interest: 4.1 }),
  '2': Object.freeze({ name: 'Plan 2', annualThreshold: 29385, monthlyThresholdPence: 244875, rate: 9, years: 30, interest: 5.46 }),
  '4': Object.freeze({ name: 'Plan 4', annualThreshold: 33795, monthlyThresholdPence: 281625, rate: 9, years: 30, interest: 4.1 }),
  '5': Object.freeze({ name: 'Plan 5', annualThreshold: 25000, monthlyThresholdPence: 208333, rate: 9, years: 40, interest: 4.1 }),
  pg: Object.freeze({ name: 'Postgraduate Loan', annualThreshold: 21000, monthlyThresholdPence: 175000, rate: 6, years: 30, interest: 6 })
});

function planFor(id) {
  if (!Object.hasOwn(PLANS, id)) throw new RangeError('Choose a valid repayment plan.');
  return PLANS[id];
}

function range(value, min, max, name) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}.`);
  }
  return value;
}

// Cash values returned by the model are integer pence.
function monthlyPAYE(plan, earningsPence) {
  const excess = Math.max(0, earningsPence - plan.monthlyThresholdPence);
  return Math.floor(excess * plan.rate / 10000) * 100;
}

export function repayment(planId, grossAnnual) {
  const plan = planFor(planId);
  const annualPence = Math.round(range(grossAnnual, 0, 1e7, 'Gross annual salary') * 100);
  const monthly = monthlyPAYE(plan, Math.round(annualPence / 12));
  const annualFormula = Math.round(Math.max(0, annualPence - plan.annualThreshold * 100) * plan.rate / 100);
  return { monthly, annualPAYE: monthly * 12, annualFormula };
}

function forecast(loan, salaries, requestedOverpayment) {
  const plan = planFor(loan.planId);
  const original = Math.round(range(loan.balance, 0, 1e7, 'Balance') * 100);
  const years = range(loan.years, 0, plan.maxYears ?? plan.years, 'Years remaining');
  if (!Number.isInteger(years)) throw new RangeError('Use whole years for the write-off forecast.');
  const annualInterest = range(loan.interest, 0, 20, 'Expected annual interest');
  const monthlyFactor = (1 + annualInterest / 100) ** (1 / 12);
  const overpayment = years > 0 ? Math.min(original, requestedOverpayment) : 0;
  let balance = original - overpayment;
  let paid = 0;
  let writtenOff = 0;
  let payoffMonth = overpayment > 0 && balance === 0 ? 0 : null;
  const rows = [];

  if (years === 0) {
    writtenOff = balance;
    balance = 0;
  }
  for (let year = 1; year <= years && balance > 0; year++) {
    const earnings = Math.round(salaries[year - 1] / 12);
    const scheduled = monthlyPAYE(plan, earnings);
    let deductions = 0;
    let cancellation = 0;
    for (let month = 1; month <= 12 && balance > 0; month++) {
      balance = Math.round(balance * monthlyFactor);
      const payment = Math.min(balance, scheduled);
      deductions += payment;
      balance -= payment;
      if (balance === 0) payoffMonth = (year - 1) * 12 + month;
    }
    if (year === years) {
      cancellation = balance;
      writtenOff = balance;
      balance = 0;
    }
    paid += deductions;
    rows.push({ deductions, balance, writtenOff: cancellation });
  }
  return { paid, writtenOff, payoffMonth, overpayment, totalCost: paid + overpayment, rows };
}

export function compareRepayment({ salary, growth, loans, lumpSum = 0, target = 0 }) {
  range(salary, 0, 1e7, 'Gross annual salary');
  range(growth, -20, 20, 'Annual salary growth');
  const requested = Math.round(range(lumpSum, 0, 1e7, 'Lump sum') * 100);
  if (!Array.isArray(loans) || loans.length < 1 || loans.length > 2 ||
      (loans.length === 2 && (loans[0].planId === 'pg' || loans[1].planId !== 'pg'))) {
    throw new RangeError('Choose one repayment plan and add a Postgraduate Loan if eligible.');
  }
  if (!Number.isInteger(target) || target < 0 || target >= loans.length) {
    throw new RangeError('Choose a loan for the lump sum.');
  }
  const salaries = Array.from({ length: 40 }, (_, index) => Math.round(salary * 100 * (1 + growth / 100) ** index));
  const results = loans.map((loan, index) => {
    const baseline = forecast(loan, salaries, 0);
    const withOverpayment = index === target && requested > 0 ? forecast(loan, salaries, requested) : baseline;
    const current = loan.balance > 0 && loan.years > 0
      ? repayment(loan.planId, salary)
      : { monthly: 0, annualPAYE: 0, annualFormula: 0 };
    return { planId: loan.planId, current, baseline, withOverpayment };
  });
  const selected = results[target];
  return {
    loans: results,
    salaries,
    requested,
    applied: selected.withOverpayment.overpayment,
    savings: selected.baseline.totalCost - selected.withOverpayment.totalCost
  };
}
