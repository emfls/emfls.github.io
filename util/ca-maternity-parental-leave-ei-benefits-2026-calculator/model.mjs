const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;

export const EI_2026 = Object.freeze({
  maxInsurableEarnings: 68_900,
  maternity: Object.freeze({ rate: 0.55, weeklyCap: 729, individualWeeks: 15 }),
  standard: Object.freeze({ rate: 0.55, weeklyCap: 729, individualWeeks: 35, sharedWeeks: 40 }),
  extended: Object.freeze({ rate: 0.33, weeklyCap: 437, individualWeeks: 61, sharedWeeks: 69 }),
});

function checkNumber(value, label, max = Infinity, whole = false) {
  if (!Number.isFinite(value) || value < 0 || value > max || (whole && !Number.isInteger(value))) {
    throw new RangeError(`Invalid ${label}.`);
  }
}

export function salaryBasedEi(annualSalary, benefitType) {
  checkNumber(annualSalary, 'annual salary');
  const benefit = EI_2026[benefitType];
  if (!Object.hasOwn(EI_2026, benefitType) || typeof benefit?.rate !== 'number') {
    throw new RangeError('Invalid benefit type.');
  }
  const weeklyInsurableEarnings = Math.min(annualSalary, EI_2026.maxInsurableEarnings) / WEEKS_PER_YEAR;
  return Math.min(benefit.weeklyCap, weeklyInsurableEarnings * benefit.rate);
}

function payment(weeklyGross, netFactor) {
  return {
    weeklyGross,
    weeklyNet: weeklyGross * netFactor,
    biweeklyGross: weeklyGross * 2,
    biweeklyNet: weeklyGross * 2 * netFactor,
  };
}

function phase(weeklyEi, weeks, topUpTarget, availableTopUpWeeks, netFactor) {
  const weeklyTopUp = Math.max(0, topUpTarget - weeklyEi);
  const topUpWeeks = weeklyTopUp > 0 ? Math.min(weeks, Math.max(0, availableTopUpWeeks)) : 0;
  return {
    weeks,
    ei: payment(weeklyEi, netFactor),
    topUp: { weeks: topUpWeeks, ...payment(topUpWeeks > 0 ? weeklyTopUp : 0, netFactor) },
  };
}

function compareOption(type, inputs) {
  const {
    parent1Salary, parent2Salary, partnerWeeks, maternity, waitingWeeks,
    returnMonth, taxPercent, topUpPercent, topUpWeeks,
  } = inputs;
  const option = EI_2026[type];
  const netFactor = 1 - taxPercent / 100;

  // Section 6(2) of the EI Act rounds the rate to the nearest whole dollar.
  const maternityEi = maternity ? Math.round(salaryBasedEi(parent1Salary, 'maternity')) : 0;
  const parentalEi = Math.round(salaryBasedEi(parent1Salary, type));
  const partnerEi = Math.round(salaryBasedEi(parent2Salary, type));
  const partnerPaid = partnerEi > 0 ? partnerWeeks : 0;
  const plannedMaternity = maternityEi > 0 ? EI_2026.maternity.individualWeeks : 0;
  const plannedParental = parentalEi > 0 ? Math.min(option.individualWeeks, option.sharedWeeks - partnerPaid) : 0;

  const weeksBeforeReturn = Math.floor(returnMonth * WEEKS_PER_YEAR / MONTHS_PER_YEAR);
  const wait = plannedMaternity + plannedParental > 0 ? Math.min(waitingWeeks, weeksBeforeReturn) : 0;
  const availableWeeks = weeksBeforeReturn - wait;
  const paidMaternity = Math.min(plannedMaternity, availableWeeks);
  const paidParental = Math.min(plannedParental, availableWeeks - paidMaternity);
  const topUpTarget = parent1Salary / WEEKS_PER_YEAR * (topUpPercent / 100);

  const maternityPhase = phase(maternityEi, paidMaternity, topUpTarget, topUpWeeks, netFactor);
  const parentalPhase = phase(parentalEi, paidParental, topUpTarget, topUpWeeks - paidMaternity, netFactor);
  const partnerPhase = phase(partnerEi, partnerPaid, 0, 0, netFactor);

  const eiGross = paidMaternity * maternityEi + paidParental * parentalEi + partnerPaid * partnerEi;
  const topUpGross = maternityPhase.topUp.weeks * maternityPhase.topUp.weeklyGross
    + parentalPhase.topUp.weeks * parentalPhase.topUp.weeklyGross;
  const lostEiGross = (plannedMaternity - paidMaternity) * maternityEi
    + (plannedParental - paidParental) * parentalEi;
  const gross = eiGross + topUpGross;

  return {
    maternity: maternityPhase,
    parental: parentalPhase,
    partner: partnerPhase,
    parent1ElapsedWeeks: wait + paidMaternity + paidParental,
    household: { eiGross, eiNet: eiGross * netFactor, topUpGross, topUpNet: topUpGross * netFactor, gross, net: gross * netFactor },
    fullPlanEiGross: eiGross + lostEiGross,
    lostEiWeeks: plannedMaternity - paidMaternity + plannedParental - paidParental,
    lostEiGross,
    lostEiNet: lostEiGross * netFactor,
  };
}

export function calculateBenefits(inputs) {
  const {
    parent1Salary, parent2Salary = 0, standardPartnerWeeks = 0, extendedPartnerWeeks = 0,
    maternity = true, waitingWeeks = 0, returnMonth, taxPercent,
    topUpPercent = 0, topUpWeeks = 0,
  } = inputs;
  checkNumber(parent1Salary, 'Parent 1 annual salary', 1_000_000_000);
  checkNumber(parent2Salary, 'Parent 2 annual salary', 1_000_000_000);
  checkNumber(standardPartnerWeeks, 'standard partner weeks', EI_2026.standard.individualWeeks, true);
  checkNumber(extendedPartnerWeeks, 'extended partner weeks', EI_2026.extended.individualWeeks, true);
  checkNumber(returnMonth, 'return month', 18);
  checkNumber(taxPercent, 'estimated tax rate', 100);
  checkNumber(topUpPercent, 'top-up target', 100);
  checkNumber(topUpWeeks, 'top-up duration', 100, true);
  checkNumber(waitingWeeks, 'waiting period', 1, true);
  if (typeof maternity !== 'boolean') throw new RangeError('Invalid maternity selection.');

  const common = {
    parent1Salary, parent2Salary, maternity, waitingWeeks, returnMonth, taxPercent, topUpPercent, topUpWeeks,
  };
  return {
    standard: compareOption('standard', { ...common, partnerWeeks: standardPartnerWeeks }),
    extended: compareOption('extended', { ...common, partnerWeeks: extendedPartnerWeeks }),
  };
}
