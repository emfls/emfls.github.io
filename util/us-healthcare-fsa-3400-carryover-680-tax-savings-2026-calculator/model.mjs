export const LIMITS = Object.freeze({
  election: 3400,
  carryover: 680,
  maxExpense: 1000000,
  federalRate: 37,
  stateRate: 13.3,
});

function hundredths(value, max, label) {
  const scaled = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > max || scaled / 100 !== value) {
    throw new RangeError(`${label} must be between 0 and ${max}, with at most two decimal places.`);
  }
  return scaled;
}

function calculateEmployee(employee) {
  if (!employee || !['carryover', 'grace', 'strict'].includes(employee.plan)) {
    throw new RangeError('Select one plan feature for each employee.');
  }
  if (!['general', 'limited'].includes(employee.coverage)) {
    throw new RangeError('Select a health FSA coverage type.');
  }
  if (![7.65, 1.45, 2.35].includes(employee.ficaRate)) {
    throw new RangeError('Select an employee payroll tax rate.');
  }

  const election = hundredths(employee.election, LIMITS.election, 'Election');
  const expenses = hundredths(employee.expenses, LIMITS.maxExpense, '2026 expenses');
  const carryoverCap = employee.plan === 'carryover'
    ? hundredths(employee.carryoverCap, LIMITS.carryover, 'Carryover cap')
    : 0;
  const graceExpenses = employee.plan === 'grace'
    ? hundredths(employee.graceExpenses, LIMITS.maxExpense, 'Grace-period expenses')
    : 0;
  const federalRate = hundredths(employee.federalRate, LIMITS.federalRate, 'Federal rate');
  const stateRate = hundredths(employee.stateRate, LIMITS.stateRate, 'State rate');
  const ficaRate = hundredths(employee.ficaRate, 7.65, 'Payroll tax rate');

  // Money stays in cents until the final output. Rates are in basis points.
  const federalSavings = Math.round(election * federalRate / 10000);
  const stateSavings = Math.round(election * stateRate / 10000);
  const ficaSavings = Math.round(election * ficaRate / 10000);
  const unusedAtYearEnd = Math.max(0, election - expenses);
  const carryover = Math.min(unusedAtYearEnd, carryoverCap);
  const graceUsed = Math.min(unusedAtYearEnd, graceExpenses);
  const forfeitureRisk = unusedAtYearEnd - carryover - graceUsed;

  return {
    totalElection: election,
    federalSavings,
    stateSavings,
    ficaSavings,
    unusedAtYearEnd,
    carryover,
    graceUsed,
    forfeitureRisk,
    safeElection: Math.min(LIMITS.election * 100, expenses + carryoverCap + graceExpenses),
  };
}

export function calculateFsa(employees) {
  if (!Array.isArray(employees) || employees.length < 1 || employees.length > 2) {
    throw new RangeError('Enter one or two eligible employees.');
  }
  const accounts = Array.from(employees, calculateEmployee);
  const totals = Object.fromEntries(Object.keys(accounts[0]).map((key) => [
    key, accounts.reduce((sum, account) => sum + account[key], 0),
  ]));
  const taxSavings = totals.federalSavings + totals.stateSavings + totals.ficaSavings;
  const netSavings = taxSavings - totals.forfeitureRisk;

  return {
    ...Object.fromEntries(Object.entries(totals).map(([key, cents]) => [key, cents / 100])),
    safeElections: accounts.map(({ safeElection }) => safeElection / 100),
    electionLimit: employees.length * LIMITS.election,
    taxSavings: taxSavings / 100,
    effectiveDiscount: totals.totalElection > 0 ? taxSavings * 100 / totals.totalElection : null,
    breakEvenForfeiture: taxSavings / 100,
    netSavings: netSavings / 100,
    netSavingsIfCarryoverExpires: (netSavings - totals.carryover) / 100,
    hsaConflict: employees.some(({ election, coverage }) => election > 0 && coverage === 'general'),
  };
}
