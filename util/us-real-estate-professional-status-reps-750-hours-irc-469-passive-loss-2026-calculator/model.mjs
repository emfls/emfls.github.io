const rates = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
const rules = {
  single: {
    bracketStarts: [0, 12400, 50400, 105700, 201775, 256225, 640600],
    excessLossThreshold: 256000,
    niitThreshold: 200000,
  },
  joint: {
    bracketStarts: [0, 24800, 100800, 211400, 403550, 512450, 768700],
    excessLossThreshold: 512000,
    niitThreshold: 250000,
  },
};

function filingRules(filingStatus) {
  if (!Object.hasOwn(rules, filingStatus)) throw new RangeError('Choose Single or Married Filing Jointly.');
  return rules[filingStatus];
}

function checkedNumber(value, label, minimum = 0, maximum = 1e12) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be between ${minimum.toLocaleString('en-US')} and ${maximum.toLocaleString('en-US')}.`);
  }
  return value;
}

function toHundredths(hours, label) {
  checkedNumber(hours, label, 0, 8784);
  const rounded = Math.round(hours * 100);
  if (Math.abs(hours * 100 - rounded) > 1e-8) {
    throw new RangeError(`Enter ${label.toLowerCase()} to at most two decimal places.`);
  }
  return rounded;
}

function hoursGap(realEstateHours, otherWorkHours) {
  return Math.max(0, Math.max(75000, otherWorkHours) + 1 - realEstateHours) / 100;
}

export function materialParticipation(activityHours, maxOtherHours) {
  return activityHours > 500 || (activityHours > 100 && activityHours >= maxOtherHours);
}

export function passiveAllowance(magi, activelyParticipated) {
  return activelyParticipated ? Math.max(0, 25000 - 0.5 * Math.max(0, magi - 100000)) : 0;
}

export function federalIncomeTax(taxableIncome, filingStatus) {
  const { bracketStarts } = filingRules(filingStatus);
  return bracketStarts.reduce((tax, start, index) => {
    const end = bracketStarts[index + 1] ?? Infinity;
    return tax + Math.max(0, Math.min(taxableIncome, end) - start) * rates[index];
  }, 0);
}

export function niit(magi, investmentIncome, filingStatus) {
  const { niitThreshold } = filingRules(filingStatus);
  return 0.038 * Math.min(Math.max(0, investmentIncome), Math.max(0, magi - niitThreshold));
}

function cents(value) {
  return Math.round(value * 100) / 100;
}

export function calculateReps(input) {
  const { filingStatus, scope } = input;
  const { excessLossThreshold } = filingRules(filingStatus);
  if (scope !== 'singleActivity' && scope !== 'electedGroup') throw new RangeError('Choose an activity scope.');
  const isJoint = filingStatus === 'joint';
  const primaryHoursGap = hoursGap(
    toHundredths(input.realEstateHours, 'Your qualifying real estate hours'),
    toHundredths(input.otherWorkHours, 'Your other personal service hours'),
  );
  const spouseHoursGap = isJoint ? hoursGap(
    toHundredths(input.spouseRealEstateHours, 'Spouse qualifying real estate hours'),
    toHundredths(input.spouseOtherWorkHours, 'Spouse other personal service hours'),
  ) : null;
  const qualifyingPerson = primaryHoursGap === 0 ? 'primary' : spouseHoursGap === 0 ? 'spouse' : null;
  const repsQualified = qualifyingPerson !== null;
  if (scope === 'electedGroup' && !repsQualified) {
    throw new RangeError('An elected rental group requires a qualifying real estate professional. Enter one activity instead.');
  }
  const activityHours = toHundredths(input.activityHours, 'Your activity hours');
  const spouseHours = isJoint ? toHundredths(input.spouseActivityHours, 'Spouse activity hours') : 0;
  const combinedActivityHours = (activityHours + spouseHours) / 100;
  const maxOtherHours = toHundredths(input.maxOtherHours, 'Highest hours from another individual') / 100;
  const materiallyParticipated = input.otherMaterialTest === true || materialParticipation(combinedActivityHours, maxOtherHours);
  const shortStay = scope === 'singleActivity' && checkedNumber(input.averageStay, 'Average customer stay', 0.00001, 366) <= 7;
  const strQualified = shortStay && materiallyParticipated;
  const status = strQualified ? 'STR_LOOPHOLE_QUALIFIED'
    : !shortStay && repsQualified && materiallyParticipated ? 'QUALIFIED_REPS' : 'PASSIVE_SUSPENDED';

  const loss = checkedNumber(input.loss, 'Current activity loss');
  const wages = checkedNumber(input.wages, 'Taxable W-2 wages');
  const passiveMagi = checkedNumber(input.passiveMagi, '§469 modified AGI', -1e12);
  const federalTaxable = checkedNumber(input.federalTaxable, 'Ordinary federal taxable income');
  const niitMagi = checkedNumber(input.niitMagi, 'NIIT modified AGI', -1e12);
  const investmentIncome = checkedNumber(input.investmentIncome, 'Net investment income', -1e12);
  const stateTaxable = checkedNumber(input.stateTaxable, 'State taxable income');
  const stateRate = checkedNumber(input.stateRate, 'State tax rate', 0, 100);
  const allowance = passiveAllowance(passiveMagi, input.activeParticipation === true);
  const passiveDeduction = Math.min(loss, allowance);

  function scenario(allowedUnder469, suspendedPassiveLoss, lossInNii) {
    const currentDeduction = Math.min(allowedUnder469, excessLossThreshold);
    const federalSavings = cents(federalIncomeTax(federalTaxable, filingStatus)
      - federalIncomeTax(federalTaxable - currentDeduction, filingStatus));
    const niitSavings = cents(niit(niitMagi, investmentIncome, filingStatus)
      - niit(niitMagi - currentDeduction, investmentIncome - (lossInNii ? currentDeduction : 0), filingStatus));
    const stateSavings = cents(Math.min(stateTaxable, currentDeduction) * stateRate / 100);
    return {
      currentDeduction,
      wageOffset: Math.min(wages, currentDeduction),
      suspendedPassiveLoss,
      excessBusinessLoss: allowedUnder469 - currentDeduction,
      federalSavings,
      niitSavings,
      stateSavings,
      totalSavings: cents(federalSavings + niitSavings + stateSavings),
    };
  }

  const passiveRental = scenario(passiveDeduction, loss - passiveDeduction, true);
  const nonpassive = scenario(loss, 0, input.nonpassiveLossInNii === true);
  const selected = status !== 'PASSIVE_SUSPENDED' ? nonpassive
    : shortStay ? scenario(0, loss, false) : passiveRental;

  return {
    status, qualifyingPerson, repsQualified, materiallyParticipated, strQualified, shortStay,
    primaryHoursGap, spouseHoursGap, combinedActivityHours,
    allowance, excessLossThreshold, selected, passiveRental, nonpassive,
  };
}
