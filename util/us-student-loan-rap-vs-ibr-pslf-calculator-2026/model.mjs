const POVERTY_2026 = Object.freeze({
  contiguous: [15960, 5680],
  alaska: [19950, 7100],
  hawaii: [18360, 6530],
});

export function povertyGuideline(familySize, region) {
  const [first, additional] = POVERTY_2026[region];
  return first + additional * (familySize - 1);
}

export function rapAnnualBase(agi) {
  if (agi <= 10000) return 120;
  const percent = Math.min(10, Math.ceil(agi / 10000) - 1);
  return agi * percent / 100;
}

export function rapMonthlyPayment(agi, dependents) {
  return Math.max(10, rapAnnualBase(agi) / 12 - 50 * dependents);
}

export function standardMonthlyPayment(balance, annualRate) {
  const rate = annualRate / 1200;
  if (rate === 0) return balance / 120;
  return balance * rate / -Math.expm1(-120 * Math.log1p(rate));
}

export function ibrMonthlyPayment(agi, guideline, ibrPlan, standardPayment) {
  const percent = ibrPlan === 'new' ? 10 : 15;
  const discretionary = Math.max(0, agi - 1.5 * guideline);
  const capped = Math.min(standardPayment, discretionary * percent / 1200);
  if (capped < 5) return 0;
  return Math.min(standardPayment, Math.max(10, capped));
}

function project(balance, annualRate, scheduledPayment, plan, limit, taxRate) {
  let principal = balance;
  let accrued = 0;
  let paid = 0;
  let waivedInterest = 0;
  let principalMatch = 0;
  let months = 0;
  let firstPayment = 0;

  while (months < limit && principal + accrued > 0) {
    const interestDue = accrued + principal * (annualRate / 1200);
    const totalDue = principal + interestDue;
    // Absorb floating-point residue at payoff and enforce the fixed benchmark term.
    const finalPayment = (plan === 'standard' && months === limit - 1)
      || (scheduledPayment > 0 && totalDue - scheduledPayment <= 1e-8);
    const payment = finalPayment ? totalDue : scheduledPayment;
    const principalPaid = finalPayment ? principal : Math.max(0, payment - interestDue);
    const unpaidInterest = Math.max(0, interestDue - payment);
    principal -= principalPaid;
    accrued = unpaidInterest;

    if (plan === 'rap') {
      waivedInterest += unpaidInterest;
      accrued = 0;
      const match = Math.min(principal, Math.max(0, Math.min(50, payment) - principalPaid));
      principal -= match;
      principalMatch += match;
    }

    if (months === 0) firstPayment = payment;
    months += 1;
    paid += payment;
  }

  const forgiven = principal + accrued;
  const forgivenessTax = forgiven * taxRate / 100;
  return {
    firstPayment, months, paid, forgiven, forgivenessTax, waivedInterest, principalMatch,
    totalCost: paid + forgivenessTax,
  };
}

// Inputs are annual dollars, a percentage interest rate, counts, and selected plan options.
export function comparePlans({ balance, annualRate, agi, dependents, familySize, region, ibrPlan, pslf, taxRate }) {
  const numbers = [balance, annualRate, agi, dependents, familySize, taxRate];
  if (!numbers.every(Number.isFinite)
    || balance < 0 || annualRate < 0 || annualRate > 100 || taxRate < 0 || taxRate > 100
    || !Number.isInteger(dependents) || dependents < 0 || !Number.isInteger(familySize) || familySize < 1
    || !Object.hasOwn(POVERTY_2026, region) || !['new', 'old'].includes(ibrPlan)
    || typeof pslf !== 'boolean') {
    throw new RangeError('Enter valid loan, income, household and tax values.');
  }

  const guideline = povertyGuideline(familySize, region);
  const standardPayment = standardMonthlyPayment(balance, annualRate);
  const rapPayment = rapMonthlyPayment(agi, dependents);
  const ibrPayment = ibrMonthlyPayment(agi, guideline, ibrPlan, standardPayment);
  const effectiveTax = pslf ? 0 : taxRate;
  const ibrMonths = ibrPlan === 'new' ? 240 : 300;
  const rap = project(balance, annualRate, rapPayment, 'rap', pslf ? 120 : 360, effectiveTax);
  const ibr = project(balance, annualRate, ibrPayment, 'ibr', pslf ? 120 : ibrMonths, effectiveTax);
  const standard = project(balance, annualRate, standardPayment, 'standard', 120, 0);

  return {
    rap, ibr, standard, guideline,
    rapVsIbr: ibr.totalCost - rap.totalCost,
    rapVsStandard: standard.totalCost - rap.totalCost,
    ibrVsStandard: standard.totalCost - ibr.totalCost,
  };
}
