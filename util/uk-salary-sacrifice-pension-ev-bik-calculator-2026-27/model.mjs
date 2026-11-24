const allowance = 12570;
const taperStart = 100000;
const additionalRateStart = 125140;
const basicTaxableLimit = 37700;
const employeeNiUpperLimit = 50270;
const employerNiRate = 0.15;

const loanThresholds = { '1': 26900, '2': 29385, '4': 33795, '5': 25000 };
const minimumWages = {
  '21-plus': 12.71, '18-to-20': 10.85, 'under-18': 8, apprentice: 8
};

const above = (value, threshold) => Math.max(0, value - threshold);
const taperIncome = income => Math.min(above(income, taperStart), additionalRateStart - taperStart);
const toPence = amount => Math.round(amount * 100);

export function personalAllowance(adjustedNetIncome) {
  return allowance - taperIncome(adjustedNetIncome) / 2;
}

export function incomeTax(adjustedNetIncome) {
  const taxable = above(adjustedNetIncome, personalAllowance(adjustedNetIncome));
  return Math.min(taxable, basicTaxableLimit) * 0.20
    + above(Math.min(taxable, additionalRateStart), basicTaxableLimit) * 0.40
    + above(taxable, additionalRateStart) * 0.45;
}

export function employeeNI(cashPay) {
  return above(Math.min(cashPay, employeeNiUpperLimit), allowance) * 0.08
    + above(cashPay, employeeNiUpperLimit) * 0.02;
}

export function employerNI(cashPay) {
  return above(cashPay, 5000) * employerNiRate;
}

export function studentLoan(cashPay, plan) {
  if (plan === 'none') return 0;
  if (!Object.hasOwn(loanThresholds, plan)) {
    throw new RangeError('Choose a supported student loan plan.');
  }
  return above(cashPay, loanThresholds[plan]) * 0.09;
}

function payroll(cashPay, bikValue, plan) {
  const adjustedNetIncome = cashPay + bikValue;
  const tax = incomeTax(adjustedNetIncome);
  const ni = employeeNI(cashPay);
  const loan = studentLoan(cashPay, plan);
  return {
    cashPay, adjustedNetIncome, tax, ni, loan,
    allowance: personalAllowance(adjustedNetIncome),
    takeHome: cashPay - tax - ni - loan
  };
}

function checkRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min.toLocaleString('en-GB')} and ${max.toLocaleString('en-GB')}.`);
  }
}

export function calculateSalarySacrifice({
  salary, evMonthly, p11d, pension = 0, pensionUnit = 'amount', plan = 'none',
  passbackPercent = 0, privateMonthly, hoursPerWeek, wageBand
}) {
  checkRange(salary, 0, 100000000, 'Annual salary');
  checkRange(evMonthly, 0, 100000000, 'Monthly EV sacrifice');
  checkRange(p11d, 0, 100000000, 'P11D list price');
  checkRange(privateMonthly, 0, 100000000, 'Private lease price');
  checkRange(passbackPercent, 0, 100, 'Employer NI share');
  checkRange(hoursPerWeek, 0.01, 168, 'Weekly hours');
  if (pensionUnit !== 'amount' && pensionUnit !== 'percent') {
    throw new RangeError('Choose a pension amount or percentage.');
  }
  if (!Object.hasOwn(minimumWages, wageBand)) {
    throw new RangeError('Choose a minimum wage band.');
  }
  checkRange(pension, 0, pensionUnit === 'percent' ? 100 : salary, 'Pension sacrifice');
  if (evMonthly > 0 && p11d === 0) {
    throw new RangeError('Enter the P11D list price for the EV lease.');
  }

  const salaryPence = toPence(salary);
  const pensionPence = toPence(pensionUnit === 'percent' ? salary * pension / 100 : pension);
  const evPence = toPence(evMonthly) * 12;
  const combinedPence = salaryPence - pensionPence - evPence;
  if (combinedPence < 0) {
    throw new RangeError('Total pension and EV sacrifice exceeds annual salary.');
  }

  const cashPay = combinedPence / 100;
  const baseline = payroll(salaryPence / 100, 0, plan);
  const pensionOnly = payroll((salaryPence - pensionPence) / 100, 0, plan);
  const employerClass1Saved = employerNI(baseline.cashPay) - employerNI(cashPay);
  const pensionTopUp = toPence(employerClass1Saved * passbackPercent / 100) / 100;
  const hourlyRate = minimumWages[wageBand];
  const annualHours = hoursPerWeek * 52;
  const annualMinimum = hourlyRate * annualHours;

  function withBikRate(rate) {
    const bikValue = p11d * rate;
    const combined = payroll(cashPay, bikValue, plan);
    const bikTax = combined.tax - incomeTax(cashPay);
    const evMonthlyCost = (pensionOnly.takeHome - combined.takeHome) / 12;
    const taxSaved = baseline.tax - combined.tax;
    const niSaved = baseline.ni - combined.ni;

    // The extra 20% income tax applies only to the portion of ANI in the taper band.
    const taperBonus = (taperIncome(baseline.adjustedNetIncome) - taperIncome(combined.adjustedNetIncome)) * 0.20;
    return {
      rate, bikValue, bikTax, combined, evMonthlyCost, taxSaved, niSaved, taperBonus,
      taxAndNiSaved: taxSaved + niSaved,
      pchMonthlySaving: privateMonthly - evMonthlyCost,
      allowanceRestored: combined.allowance - baseline.allowance,
      evLoanSaved: pensionOnly.loan - combined.loan,
      loanSaved: baseline.loan - combined.loan
    };
  }

  const current = withBikRate(0.04);
  return {
    baseline, pensionOnly, current, projection: withBikRate(0.05),
    evAnnual: evPence / 100,
    pensionSacrifice: pensionPence / 100,
    employerClass1Saved, employerClass1A: current.bikValue * employerNiRate,
    pensionTopUp, pensionTotal: pensionPence / 100 + pensionTopUp,
    floor: {
      hourlyRate, annualMinimum, effectiveHourlyPay: cashPay / annualHours,
      below: cashPay < annualMinimum - 1e-8
    }
  };
}
