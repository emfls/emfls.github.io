// 6 April 2026 to 5 April 2027. All amounts are in GBP.
export const RATES = Object.freeze({
  personalAllowance: 12570,
  taperStart: 100000,
  basicBand: 37700,
  basicIncomeCap: 50270,
  additionalBandStart: 125140,
  employeePrimaryThreshold: 12570,
  employeeUpperLimit: 50270,
  employeeMainRate: 0.08,
  employeeUpperRate: 0.02,
  employerThreshold: 5000,
  employerRate: 0.15,
  levyRate: 0.005,
  employmentAllowance: 10500,
  smallProfitLimit: 50000,
  mainProfitLimit: 250000,
  smallCorporationRate: 0.19,
  mainCorporationRate: 0.25,
  marginalReliefFraction: 3 / 200,
  dividendAllowance: 500
});

export const DEFAULTS = Object.freeze({
  dayRate: 500,
  billableDays: 220,
  margin: 25,
  marginPeriods: 44,
  insidePension: 0,
  levyApplies: true,
  expenses: 740,
  accountancyFee: 1200,
  outsidePension: 0,
  directorSalary: 12570,
  employmentAllowance: false,
  dividendMode: 'full'
});

const positive = (amount) => Math.max(0, amount);

export function personalAllowance(adjustedNetIncome) {
  return positive(RATES.personalAllowance - positive(adjustedNetIncome - RATES.taperStart) / 2);
}

function taxBetween(start, end, rates) {
  const basic = positive(Math.min(end, RATES.basicBand) - start);
  const higher = positive(Math.min(end, RATES.additionalBandStart) - Math.max(start, RATES.basicBand));
  const additional = positive(end - Math.max(start, RATES.additionalBandStart));
  return basic * rates[0] + higher * rates[1] + additional * rates[2];
}

export function personalTaxes(salary, dividends = 0) {
  const allowance = personalAllowance(salary + dividends);
  const taxableSalary = positive(salary - allowance);
  const taxableDividends = positive(dividends - positive(allowance - salary));
  const dividendZeroBand = Math.min(taxableDividends, RATES.dividendAllowance);
  return {
    allowance,
    incomeTax: taxBetween(0, taxableSalary, [0.20, 0.40, 0.45]),
    // The dividend allowance is a zero-rate band and still uses tax-band capacity.
    dividendTax: taxBetween(
      taxableSalary + dividendZeroBand,
      taxableSalary + taxableDividends,
      [0.1075, 0.3575, 0.3935]
    )
  };
}

export function employeeNI(grossPay) {
  return positive(Math.min(grossPay, RATES.employeeUpperLimit) - RATES.employeePrimaryThreshold)
    * RATES.employeeMainRate + positive(grossPay - RATES.employeeUpperLimit) * RATES.employeeUpperRate;
}

export function employerNI(grossPay) {
  return positive(grossPay - RATES.employerThreshold) * RATES.employerRate;
}

export function corporationTax(profit) {
  if (profit <= RATES.smallProfitLimit) return positive(profit) * RATES.smallCorporationRate;
  // One standalone company with a 12-month period and augmented profit equal to taxable profit.
  const relief = positive(RATES.mainProfitLimit - profit) * RATES.marginalReliefFraction;
  return profit * RATES.mainCorporationRate - relief;
}

function umbrellaCosts(input) {
  return {
    margin: input.margin * input.marginPeriods,
    levyRate: input.levyApplies ? RATES.levyRate : 0
  };
}

export function umbrella(input) {
  const billing = input.dayRate * input.billableDays;
  const { margin, levyRate } = umbrellaCosts(input);
  const available = billing - margin - input.insidePension;
  const pot = positive(available);
  const grossPay = pot <= RATES.employerThreshold * (1 + levyRate)
    ? pot / (1 + levyRate)
    : (pot + RATES.employerThreshold * RATES.employerRate) / (1 + levyRate + RATES.employerRate);
  const { allowance, incomeTax } = personalTaxes(grossPay);
  const employeeContribution = employeeNI(grossPay);
  const net = grossPay - incomeTax - employeeContribution;
  return {
    billing, margin, grossPay, allowance, incomeTax, net,
    pension: input.insidePension,
    levy: grossPay * levyRate,
    employerNI: employerNI(grossPay),
    employeeNI: employeeContribution,
    retention: billing > 0 ? net / billing : null,
    shortfall: positive(-available)
  };
}

export function limitedCompany(input) {
  const billing = input.dayRate * input.billableDays;
  const employerContribution = employerNI(input.directorSalary);
  const employmentAllowanceUsed = input.employmentAllowance
    ? Math.min(employerContribution, RATES.employmentAllowance) : 0;
  const employerNIPaid = employerContribution - employmentAllowanceUsed;
  const profit = billing - input.expenses - input.accountancyFee - input.outsidePension
    - input.directorSalary - employerNIPaid;
  const companyTax = corporationTax(profit);
  const distributable = positive(profit - companyTax);
  const dividends = input.dividendMode === 'basic-cap'
    ? Math.min(distributable, positive(RATES.basicIncomeCap - input.directorSalary))
    : distributable;
  const { allowance, incomeTax, dividendTax } = personalTaxes(input.directorSalary, dividends);
  const employeeContribution = employeeNI(input.directorSalary);
  const net = input.directorSalary + dividends - incomeTax - employeeContribution - dividendTax;
  return {
    billing, profit, distributable, dividends, allowance, incomeTax, dividendTax, net,
    salary: input.directorSalary,
    pension: input.outsidePension,
    expenses: input.expenses,
    accountancyFee: input.accountancyFee,
    employerNI: employerNIPaid,
    employmentAllowanceUsed,
    employeeNI: employeeContribution,
    corporationTax: companyTax,
    retainedProfit: distributable - dividends,
    retention: billing > 0 && profit >= 0 ? net / billing : null,
    shortfall: positive(-profit)
  };
}

export function matchingInsideRate(input, targetNet) {
  if (input.billableDays <= 0 || targetNet <= 0) return null;

  const { margin, levyRate } = umbrellaCosts(input);
  // Net pay rises by at least 38p per £1 of gross even in the PA taper.
  const grossUpperBound = targetNet / 0.38 + 1;
  const billingUpperBound = margin + input.insidePension + grossUpperBound * (1 + levyRate)
    + employerNI(grossUpperBound);
  let low = 0;
  let high = Math.ceil(billingUpperBound / input.billableDays * 100);

  // Search whole pennies so the quoted day rate covers the target.
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const { net } = umbrella({ ...input, dayRate: mid / 100 });
    if (net >= targetNet) high = mid;
    else low = mid + 1;
  }
  return low / 100;
}

export function compare(input) {
  for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
    if (typeof defaultValue === 'number'
      && (!Number.isFinite(input[key]) || input[key] < 0 || input[key] > 1e9)) {
      throw new RangeError('Enter a valid non-negative amount for each field.');
    }
  }
  if (!Number.isInteger(input.billableDays) || input.billableDays > 366
    || !Number.isInteger(input.marginPeriods) || input.marginPeriods > 53) {
    throw new RangeError('Enter whole days and valid billing periods.');
  }
  if (!['full', 'basic-cap'].includes(input.dividendMode)
    || typeof input.levyApplies !== 'boolean' || typeof input.employmentAllowance !== 'boolean') {
    throw new RangeError('Select a valid payroll and dividend option.');
  }

  const inside = umbrella(input);
  const outside = limitedCompany(input);
  const funded = outside.shortfall === 0;
  const annualGap = funded && inside.shortfall === 0 ? outside.net - inside.net : null;
  const matchRate = funded ? matchingInsideRate(input, outside.net) : null;
  return {
    inside, outside, annualGap, matchRate,
    dailyGap: annualGap !== null && input.billableDays > 0 ? annualGap / input.billableDays : null,
    uplift: matchRate !== null && input.dayRate > 0 ? matchRate / input.dayRate - 1 : null
  };
}
