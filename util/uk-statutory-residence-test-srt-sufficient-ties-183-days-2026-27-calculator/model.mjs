const ARRIVER_BANDS = [[90, 4], [120, 3], [182, 2]];
const LEAVER_BANDS = [[45, 4], [90, 3], [120, 2], [182, 1]];

function overseasLimit(previouslyResident) {
  return previouslyResident ? 15 : 45;
}

function validateDays(...counts) {
  if (counts.some(days => !Number.isInteger(days) || days < 0 || days > 365)) {
    throw new RangeError('Use whole day counts from 0 to 365.');
  }
}

export function meetsUKHomeTest(ukHomeDays, highestOverseasHomeDays) {
  validateDays(ukHomeDays, highestOverseasHomeDays);
  return ukHomeDays >= 30 && highestOverseasHomeDays < 30;
}

export function meetsUKWorkTest(periodUKWorkdays, periodWorkdays, taxYearUKWorkdays) {
  validateDays(periodUKWorkdays, periodWorkdays, taxYearUKWorkdays);
  if (periodUKWorkdays > periodWorkdays) {
    throw new RangeError('UK workdays in the 365-day period cannot exceed total workdays in that period.');
  }
  return taxYearUKWorkdays > 0 && periodUKWorkdays * 4 > periodWorkdays * 3;
}

export function maxSafeDays(previouslyResident, tieCount) {
  if (typeof previouslyResident !== 'boolean' || !Number.isInteger(tieCount)
      || tieCount < 0 || tieCount > (previouslyResident ? 5 : 4)) {
    throw new RangeError('Enter a valid residence history and tie count.');
  }
  const bands = previouslyResident ? LEAVER_BANDS : ARRIVER_BANDS;
  let limit = overseasLimit(previouslyResident);
  for (const [lastDay, requiredTies] of bands) {
    if (tieCount >= requiredTies) break;
    limit = lastDay;
  }
  return limit;
}

export function evaluateResidence({
  previouslyResident, ukDays, ukWorkdays, priorDays1, priorDays2,
  family, accommodation, country, overseasWork, ukHome, ukWork, overseasUkDays = ukDays
}) {
  validateDays(ukDays, ukWorkdays, priorDays1, priorDays2, overseasUkDays);
  if (overseasUkDays > ukDays) {
    throw new RangeError('The overseas-test count cannot exceed the main UK day count.');
  }
  if ([previouslyResident, family, accommodation, country, overseasWork, ukHome, ukWork]
    .some(answer => typeof answer !== 'boolean')) {
    throw new RangeError('Answer each residence, work, home and tie question.');
  }

  const ties = {
    family,
    accommodation,
    work: ukWorkdays >= 40,
    prior90: priorDays1 > 90 || priorDays2 > 90,
    country: previouslyResident && country
  };
  const activeTies = Object.values(ties).filter(Boolean).length;
  const tieLimit = previouslyResident ? 5 : 4;
  const shortStayLimit = overseasLimit(previouslyResident);
  const bands = previouslyResident ? LEAVER_BANDS : ARRIVER_BANDS;
  const requiredTies = ukDays > shortStayLimit
    ? (bands.find(([lastDay]) => ukDays <= lastDay)?.[1] ?? null)
    : null;

  const tiesOnlyMaxDays = maxSafeDays(previouslyResident, activeTies);
  const overseasWorkEligible = overseasWork && ukWorkdays < 31;
  // Hold the entered ties, workdays and any difference in statutory day counts fixed.
  const overseasWorkCap = overseasWorkEligible ? 90 + ukDays - overseasUkDays : 0;
  const baseCap = ukHome || ukWork ? shortStayLimit : tiesOnlyMaxDays;
  const maxSafe = Math.min(182, Math.max(baseCap, overseasWorkCap));

  let verdict = 'NON_UK_RESIDENT';
  let step = 'AUTOMATIC_OVERSEAS';
  let test;
  if (ukDays >= 183) {
    verdict = 'UK_TAX_RESIDENT';
    step = 'AUTOMATIC_UK';
    test = 'UK_183_DAYS';
  } else if (ukDays <= shortStayLimit) {
    test = previouslyResident ? 'OVERSEAS_LEAVER' : 'OVERSEAS_ARRIVER';
  } else if (overseasWorkEligible && overseasUkDays <= 90) {
    test = 'OVERSEAS_WORK';
  } else if (ukHome || ukWork) {
    verdict = 'UK_TAX_RESIDENT';
    step = 'AUTOMATIC_UK';
    test = ukHome ? 'UK_HOME' : 'UK_WORK';
  } else {
    step = 'SUFFICIENT_TIES';
    const sufficient = activeTies >= requiredTies;
    verdict = sufficient ? 'UK_TAX_RESIDENT' : 'NON_UK_RESIDENT';
    test = sufficient ? 'ENOUGH_TIES' : 'TOO_FEW_TIES';
  }

  return {
    verdict, step, test, ties, activeTies, tieLimit, requiredTies, tiesOnlyMaxDays,
    maxSafeDays: maxSafe, remainingDays: maxSafe - ukDays
  };
}
