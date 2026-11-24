export const RULES = Object.freeze({
  lct: 91661,
  carLimit: 69883,
  gstCap: 6353,
  transitionLimit: 75000,
  medicare: 0.02,
  statutory: 0.20,
  taper: 0.15,
  rfbaGrossUp: 1.8868,
  rfbaThreshold: 2000,
  fbtRate: 0.47,
  type1GrossUp: 2.0802,
  gst: 0.10,
  residual: Object.freeze({ 3: 0.4688, 5: 0.2813 })
});

const taxBrackets = [
  [190000, 51370, 0.45],
  [135000, 31020, 0.37],
  [45000, 4020, 0.30],
  [18200, 0, 0.15]
];

function requireRange(value, label, min = 0, max = Infinity) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter a valid ${label}.`);
  }
}

export function incomeTax(income) {
  requireRange(income, 'taxable income');
  for (const [threshold, tax, rate] of taxBrackets) {
    if (income > threshold) return tax + (income - threshold) * rate;
  }
  return 0;
}

export function taxWithMedicare(income) {
  return incomeTax(income) + income * RULES.medicare;
}

export function determineTreatment({ vehicle, eligibilityConfirmed, price, baseValue, phase }) {
  requireRange(price, 'car price', 1);
  requireRange(baseValue ?? price, 'FBT base value', 1);
  if (!['bev', 'phev', 'other'].includes(vehicle) || typeof eligibilityConfirmed !== 'boolean' ||
      !['current', 'transition', 'later'].includes(phase)) {
    throw new RangeError('Choose a valid vehicle, eligibility status and start period.');
  }
  const thresholdValue = phase === 'current' ? price : (baseValue ?? price);
  if (vehicle !== 'bev' || !eligibilityConfirmed || thresholdValue > RULES.lct) {
    return { rate: RULES.statutory, kind: 'standard' };
  }
  if (phase === 'later' || (phase === 'transition' && (baseValue ?? price) > RULES.transitionLimit)) {
    return { rate: RULES.taper, kind: 'discounted' };
  }
  return { rate: 0, kind: 'exempt' };
}

export function purchaseGstCredit(price) {
  requireRange(price, 'GST-inclusive purchase price');
  return Math.min(price / 11, RULES.gstCap);
}

export function reportableBenefit(baseValue, employeeContribution = 0) {
  requireRange(baseValue, 'FBT base value');
  requireRange(employeeContribution, 'employee contribution');
  const value = baseValue * RULES.statutory - employeeContribution;
  return value > RULES.rfbaThreshold ? value * RULES.rfbaGrossUp : 0;
}

export function monthlyPayment(principal, annualRate, months, balloon = 0) {
  requireRange(principal, 'principal');
  requireRange(annualRate, 'annual rate', 0, 1);
  requireRange(balloon, 'balloon', 0, principal);
  if (!Number.isSafeInteger(months) || months < 1) throw new RangeError('Enter a valid term.');
  const rate = annualRate / 12;
  if (rate === 0) return (principal - balloon) / months;
  const annuityFactor = -Math.expm1(-months * Math.log1p(rate)) / rate;
  return (principal - balloon) / annuityFactor + balloon * rate;
}

export function calculateComparison(input) {
  const { salary, price, onRoad, gstRunning, otherRunning, fees, leaseRate, loanRate,
    offsetRate, years, phase } = input;
  const baseValue = input.baseValue ?? price;
  requireRange(salary, 'annual salary', 0, 1000000000);
  for (const [label, value] of Object.entries({
    'car price': price, 'FBT base value': baseValue, 'on-road charges': onRoad,
    'GST-bearing running costs': gstRunning, 'other running costs': otherRunning, 'annual fees': fees
  })) requireRange(value, label, 0, 1000000000);
  requireRange(offsetRate, 'offset rate', 0, 1);
  if (years !== 3 && years !== 5) throw new RangeError('Choose a 3- or 5-year term.');

  const treatment = determineTreatment(input);
  const months = years * 12;
  const growth = (1 + offsetRate) ** years;
  const monthlyGrowthRate = Math.expm1(Math.log1p(offsetRate) / 12);
  const savingsFactor = monthlyGrowthRate === 0
    ? months
    : Math.expm1(months * Math.log1p(monthlyGrowthRate)) / monthlyGrowthRate;
  const driveAway = price + onRoad;
  const running = gstRunning + otherRunning;
  const gstPurchaseCredit = purchaseGstCredit(price);
  const gstRunningCredit = gstRunning / 11;
  const gstMultiplier = 1 + RULES.gst;
  const financed = driveAway - gstPurchaseCredit;
  const residual = price * RULES.residual[years];
  const leasePayment = monthlyPayment(financed, leaseRate, months, residual / gstMultiplier);
  const annualPackage = leasePayment * 12 + running - gstRunningCredit + fees;
  const taxBefore = taxWithMedicare(salary);

  function estimateLease(leaseTreatment) {
    const statutoryValue = baseValue * leaseTreatment.rate;
    // Payroll ECM includes GST. Cap contributions at the GST-inclusive package budget.
    const postTax = Math.min(statutoryValue, annualPackage * gstMultiplier);
    const uncoveredValue = Math.max(0, statutoryValue - postTax);
    const fbt = uncoveredValue * RULES.fbtRate * RULES.type1GrossUp;
    const preTax = Math.max(0, annualPackage - postTax / gstMultiplier) + fbt;
    if (preTax > salary) return null;

    const taxableSalary = salary - preTax;
    const taxSaving = taxBefore - taxWithMedicare(taxableSalary);
    const net = preTax + postTax - taxSaving;
    const rfba = reportableBenefit(baseValue, postTax);
    return {
      ...leaseTreatment, financed, residual, monthlyPayment: leasePayment, gstPurchaseCredit,
      gstRunningCredit, preTax, postTax, fbt, taxableSalary, taxSaving, net, rfba,
      salaryPlusRfba: taxableSalary + rfba,
      nominal: net * years + residual,
      offsetAdjusted: net / 12 * savingsFactor + residual
    };
  }

  const lease = estimateLease(treatment);
  if (!lease) throw new RangeError('The pre-tax package exceeds the annual salary entered.');
  const before = estimateLease(determineTreatment({ ...input, phase: 'current' }));
  const transition = estimateLease(determineTreatment({ ...input, phase: 'transition' }));
  const loanPayment = monthlyPayment(driveAway, loanRate, months);
  const cash = {
    nominal: driveAway + running * years,
    offsetAdjusted: driveAway * growth + running / 12 * savingsFactor,
    purchaseOpportunity: driveAway * Math.expm1(years * Math.log1p(offsetRate))
  };
  const loan = {
    monthlyPayment: loanPayment,
    interest: loanPayment * months - driveAway,
    nominal: loanPayment * months + running * years,
    offsetAdjusted: (loanPayment + running / 12) * savingsFactor
  };
  return {
    lease, phase, before, transition, cash, loan, years, baseValue,
    savings: {
      cash: cash.offsetAdjusted - lease.offsetAdjusted,
      loan: loan.offsetAdjusted - lease.offsetAdjusted,
      cashNominal: cash.nominal - lease.nominal,
      loanNominal: loan.nominal - lease.nominal
    }
  };
}
