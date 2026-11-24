export const QPIP_MIE = 103000;
export const EI_MIE = 68900;
const YEAR_WEEKS = 52;
const MAX_SALARY = 1000000000;

function validateSalary(salary) {
  if (!Number.isFinite(salary) || salary < 0 || salary > MAX_SALARY) {
    throw new RangeError('Enter annual salaries from $0 to $1 billion.');
  }
}

function validateWeeks(weeks, min, max, label) {
  if (!Number.isInteger(weeks) || weeks < min || weeks > max) {
    throw new RangeError(`${label} must be a whole number from ${min} to ${max}.`);
  }
}

function toCents(amount) {
  return Math.round(amount * 100);
}

export function qpipWeeklyBenefit(salary, rate) {
  validateSalary(salary);
  if (![55, 70, 75].includes(rate)) throw new RangeError('Unknown QPIP rate.');
  return Math.round(Math.min(salary, QPIP_MIE) * rate / YEAR_WEEKS) / 100;
}

export function eiWeeklyBenefit(salary, rate) {
  validateSalary(salary);
  if (![33, 55].includes(rate)) throw new RangeError('Unknown EI rate.');
  // EI rounds weekly benefits to the nearest dollar, with half dollars rounded up.
  return Math.round(Math.min(salary, EI_MIE) * rate / (YEAR_WEEKS * 100));
}

export function basicHighWeekBounds(otherWeeks) {
  validateWeeks(otherWeeks, 0, 32, 'Basic parental weeks for the other parent');
  return { min: Math.max(0, otherWeeks - 25), max: Math.min(7, otherWeeks) };
}

function parentBenefits(salary, schedule, weeklyBenefit) {
  const segments = schedule.filter(([, weeks]) => weeks > 0).map(([label, weeks, rate]) => ({
    label, weeks, rate, weeklyBenefit: weeklyBenefit(salary, rate),
  }));
  const leaveWeeks = segments.reduce((total, segment) => total + segment.weeks, 0);
  const benefitCents = segments.reduce((total, segment) =>
    total + segment.weeks * toCents(segment.weeklyBenefit), 0);
  return { segments, leaveWeeks, totalBenefits: benefitCents / 100 };
}

function qpipPlan(salaries, baseSchedules, bonusWeeks, bonusRate, bonusIndex) {
  const parents = baseSchedules.map((schedule, index) => {
    const bonus = index === bonusIndex ? bonusWeeks : 0;
    const salary = salaries[index];
    const parent = parentBenefits(salary, [...schedule, ['Sharing bonus', bonus, bonusRate]], qpipWeeklyBenefit);
    const workWeeks = YEAR_WEEKS - parent.leaveWeeks;
    return { ...parent, workWeeks, salaryIncome: toCents(salary * workWeeks / YEAR_WEEKS) / 100 };
  });
  const benefitCents = parents.reduce((total, parent) => total + toCents(parent.totalBenefits), 0);
  const salaryCents = parents.reduce((total, parent) => total + toCents(parent.salaryIncome), 0);
  return {
    parents,
    benefitWeeks: parents[0].leaveWeeks + parents[1].leaveWeeks,
    bonusWeeks,
    bonusBenefits: bonusWeeks * toCents(qpipWeeklyBenefit(salaries[bonusIndex], bonusRate)) / 100,
    totalBenefits: benefitCents / 100,
    salaryIncome: salaryCents / 100,
    cash52: (benefitCents + salaryCents) / 100,
  };
}

function eiPlan(salaries, otherWeeks, familyLimit, individualLimit, rate) {
  const birthWeeks = Math.min(individualLimit, familyLimit - otherWeeks);
  const parents = [
    parentBenefits(salaries[0], [['Maternity', 15, 55], ['Parental', birthWeeks, rate]], eiWeeklyBenefit),
    parentBenefits(salaries[1], [['Parental', otherWeeks, rate]], eiWeeklyBenefit),
  ];
  return {
    parents,
    benefitWeeks: 15 + birthWeeks + otherWeeks,
    totalBenefits: parents[0].totalBenefits + parents[1].totalBenefits,
  };
}

function difference(a, b) {
  return (toCents(a) - toCents(b)) / 100;
}

export function comparePlans({
  birthSalary, otherSalary, basicOtherWeeks, basicOtherHighWeeks, specialOtherWeeks,
  bonusRecipient, eiStandardOtherWeeks, eiExtendedOtherWeeks,
}) {
  validateSalary(birthSalary);
  validateSalary(otherSalary);
  const highBounds = basicHighWeekBounds(basicOtherWeeks);
  validateWeeks(basicOtherHighWeeks, highBounds.min, highBounds.max, 'Basic 70% parental weeks for the other parent');
  validateWeeks(specialOtherWeeks, 0, 25, 'Special parental weeks for the other parent');
  validateWeeks(eiStandardOtherWeeks, 0, 35, 'Standard EI parental weeks for the other parent');
  validateWeeks(eiExtendedOtherWeeks, 0, 61, 'Extended EI parental weeks for the other parent');
  if (!['birth', 'other'].includes(bonusRecipient)) throw new RangeError('Choose a parent for bonus weeks.');

  const salaries = [birthSalary, otherSalary];
  const bonusIndex = bonusRecipient === 'birth' ? 0 : 1;
  const basicOtherLowWeeks = basicOtherWeeks - basicOtherHighWeeks;
  const basicBonus = Math.min(basicOtherWeeks, 32 - basicOtherWeeks) >= 8 ? 4 : 0;
  const specialBonus = Math.min(specialOtherWeeks, 25 - specialOtherWeeks) >= 6 ? 3 : 0;
  const basic = qpipPlan(salaries, [
    [['Maternity', 18, 70], ['Parental', 7 - basicOtherHighWeeks, 70], ['Parental', 25 - basicOtherLowWeeks, 55]],
    [['Paternity', 5, 70], ['Parental', basicOtherHighWeeks, 70], ['Parental', basicOtherLowWeeks, 55]],
  ], basicBonus, 55, bonusIndex);
  const special = qpipPlan(salaries, [
    [['Maternity', 15, 75], ['Parental', 25 - specialOtherWeeks, 75]],
    [['Paternity', 3, 75], ['Parental', specialOtherWeeks, 75]],
  ], specialBonus, 75, bonusIndex);
  const standard = eiPlan(salaries, eiStandardOtherWeeks, 40, 35, 55);
  const extended = eiPlan(salaries, eiExtendedOtherWeeks, 69, 61, 33);

  return {
    basic, special,
    benefitDifference: difference(basic.totalBenefits, special.totalBenefits),
    cashDifference: difference(basic.cash52, special.cash52),
    ei: { standard, extended },
    eiGap: {
      basic: { standard: difference(basic.totalBenefits, standard.totalBenefits), extended: difference(basic.totalBenefits, extended.totalBenefits) },
      special: { standard: difference(special.totalBenefits, standard.totalBenefits), extended: difference(special.totalBenefits, extended.totalBenefits) },
    },
  };
}
