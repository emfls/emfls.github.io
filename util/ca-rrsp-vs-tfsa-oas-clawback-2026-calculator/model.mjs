export const RULES = Object.freeze({
  rrspLimit: 33810,
  rrspEarnedIncomeRate: 0.18,
  tfsaLimit: 7000,
  tfsaCumulative: 109000,
  oasThreshold: 95323,
  priorOasThreshold: 93454,
  oasRate: 0.15,
});

function requireRange(value, name, min, max, whole = false) {
  if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    const unit = whole ? ' a whole number' : ' a number';
    throw new RangeError(`${name} must be${unit} from ${min} to ${max}.`);
  }
}

export function rrspRoom(priorIncome, carry = 0, adjustment = 0) {
  requireRange(priorIncome, 'Prior-year earned income', 0, 1e8);
  requireRange(carry, 'Unused RRSP room', 0, 1e8);
  requireRange(adjustment, 'RRSP room adjustments', -1e8, 1e8);
  const newRoom = Math.min(priorIncome * RULES.rrspEarnedIncomeRate, RULES.rrspLimit);
  return Math.max(0, newRoom + carry + adjustment);
}

function recovery(income, annualOas) {
  return Math.min(annualOas, Math.max(0, income - RULES.oasThreshold) * RULES.oasRate);
}

export function annualOasRecovery(income, annualOas) {
  requireRange(income, 'Net world income', -1e8, Number.MAX_VALUE);
  requireRange(annualOas, 'Annual OAS benefit', 0, 1e8);
  return recovery(income, annualOas);
}

function projectRrsp(deposit, growth, baselineRecovery, options) {
  const {
    currentRate, retirementRate, withdrawalYears, baselineIncome, annualOas, recoveryTaxTreatment,
  } = options;
  const gross = deposit * growth;
  const annualWithdrawal = gross / withdrawalYears;
  const annualOasLoss = recovery(baselineIncome + annualWithdrawal, annualOas) - baselineRecovery;
  const oasLoss = annualOasLoss * withdrawalYears;
  const taxableWithdrawal = recoveryTaxTreatment === 'deductible' ? gross - oasLoss : gross;
  const incomeTax = taxableWithdrawal * retirementRate;

  return {
    deposit,
    refund: deposit * currentRate,
    gross,
    annualWithdrawal,
    incomeTax,
    oasLoss,
    oasRate: gross > 0 ? oasLoss / gross : 0,
    effectiveRate: gross > 0 ? (incomeTax + oasLoss) / gross : 0,
    net: Math.max(0, gross - incomeTax - oasLoss),
  };
}

export function compareAccounts(options) {
  const {
    budget, budgetType, priorIncome, rrspCarry, rrspAdjustment, tfsaExtraRoom, currentRate,
    retirementRate, annualReturn, years, withdrawalYears, baselineIncome, annualOas,
    recoveryTaxTreatment,
  } = options;
  requireRange(budget, 'Budget', 0, 1e8);
  requireRange(currentRate, 'Working marginal tax rate', 0, 0.9999);
  requireRange(retirementRate, 'Retirement marginal tax rate', 0, 0.85);
  requireRange(annualReturn, 'Annual investment return', -1, 1);
  requireRange(years, 'Years until retirement', 0, 75, true);
  requireRange(withdrawalYears, 'Withdrawal years', 1, 50, true);
  requireRange(tfsaExtraRoom, 'TFSA room adjustment', -RULES.tfsaLimit, 1e8);
  requireRange(baselineIncome, 'Baseline net world income', -1e8, 1e8);
  if (!['afterTax', 'preTax'].includes(budgetType)) {
    throw new RangeError('Choose a budget type.');
  }
  if (!['additive', 'deductible'].includes(recoveryTaxTreatment)) {
    throw new RangeError('Choose an OAS tax treatment.');
  }

  const baselineRecovery = annualOasRecovery(baselineIncome, annualOas);
  const availableRrspRoom = rrspRoom(priorIncome, rrspCarry, rrspAdjustment);
  const availableTfsaRoom = RULES.tfsaLimit + tfsaExtraRoom;
  const retainedShare = 1 - currentRate;
  const requestedCash = budgetType === 'preTax' ? budget * retainedShare : budget;
  const investedCash = Math.min(requestedCash, availableTfsaRoom, availableRrspRoom * retainedShare);
  const grossedUpDeposit = Math.min(availableRrspRoom, investedCash / retainedShare);

  // Hold the portfolio return constant and spread each retirement balance in equal annual instalments.
  const growth = (1 + annualReturn) ** years;
  const reinvested = projectRrsp(grossedUpDeposit, growth, baselineRecovery, options);
  const spent = projectRrsp(investedCash, growth, baselineRecovery, options);
  const tfsaGross = investedCash * growth;
  const tfsa = {
    deposit: investedCash, refund: 0, gross: tfsaGross, net: tfsaGross,
    annualWithdrawal: tfsaGross / withdrawalYears,
    incomeTax: 0, oasLoss: 0, oasRate: 0, effectiveRate: 0,
  };
  const difference = reinvested.net - tfsa.net;
  const tied = Math.abs(difference) <= Number.EPSILON * 8 * Math.max(1, reinvested.net, tfsa.net);
  let winner = 'none';
  if (investedCash > 0) {
    winner = tied ? 'tie' : difference > 0 ? 'rrsp' : 'tfsa';
  }

  return {
    requestedCash,
    investedCash,
    uninvestedCash: requestedCash - investedCash,
    availableRrspRoom,
    availableTfsaRoom,
    baselineRecovery,
    fullRecoveryIncome: annualOas > 0 ? RULES.oasThreshold + annualOas / RULES.oasRate : null,
    reinvested,
    spent,
    tfsa,
    winner,
    margin: tied ? 0 : Math.abs(difference),
    refundCost: Math.max(0, reinvested.net - spent.net),
  };
}
