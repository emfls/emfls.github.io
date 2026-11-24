export const OAS = Object.freeze({
  baseMonthly: 762.50,
  age75Multiplier: 1.10,
  monthlyBonus: 0.006,
  recoveryThreshold: 95323,
  recoveryRate: 0.15,
  comparisonLimit: 100,
});

const monthsPerYear = 12;
const roundMoney = value => Math.round((value + 1e-9) * 100) / 100;

function quote(residenceFraction, delayMonths, age75, income) {
  const pension = OAS.baseMonthly * residenceFraction * (1 + delayMonths * OAS.monthlyBonus);
  const grossMonthly = roundMoney(pension * (age75 ? OAS.age75Multiplier : 1));
  const grossAnnual = roundMoney(grossMonthly * monthsPerYear);
  const excess = Math.max(0, income - OAS.recoveryThreshold);
  const recoveryAnnual = roundMoney(Math.min(grossAnnual, excess * OAS.recoveryRate));
  const netAnnual = roundMoney(grossAnnual - recoveryAnnual);

  return {
    grossMonthly,
    grossAnnual,
    recoveryAnnual,
    netAnnual,
    netMonthly: netAnnual / monthsPerYear,
    eliminationIncome: roundMoney(OAS.recoveryThreshold + grossAnnual / OAS.recoveryRate),
  };
}

export function calculateOas({
  residenceYears, startAge, monthOffset, incomeBefore70, incomeFrom70, realRate, lifeAge, gis,
}) {
  const fields = [
    ['Residence years', residenceYears, 10, Infinity, true],
    ['Start age', startAge, 65, 70, true],
    ['Extra months', monthOffset, 0, startAge === 70 ? 0 : 11, true],
    ['Income at ages 65–69', incomeBefore70, 0, Infinity, false],
    ['Income at age 70+', incomeFrom70, 0, Infinity, false],
    ['Real annual rate', realRate, -10, 30, false],
    ['Life expectancy age', lifeAge, 75, OAS.comparisonLimit, true],
  ];

  for (const [label, value, min, max, integer] of fields) {
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new RangeError(`${label} is outside the supported range.`);
    }
  }
  if (typeof gis !== 'boolean') throw new RangeError('Select a GIS status.');

  const residenceFraction = Math.min(40, residenceYears) / 40;
  const delayMonths = (startAge - 65) * monthsPerYear + monthOffset;
  const incomeChangeMonth = (70 - 65) * monthsPerYear;
  const boostMonth = (75 - 65) * monthsPerYear;
  const lifetimeMonths = (lifeAge - 65) * monthsPerYear;
  const limitMonths = (OAS.comparisonLimit - 65) * monthsPerYear;
  const deferredStartIncome = delayMonths < incomeChangeMonth ? incomeBefore70 : incomeFrom70;

  const early = {
    start: quote(residenceFraction, 0, false, incomeBefore70),
    age75: quote(residenceFraction, 0, true, incomeFrom70),
    lifetime: 0,
  };
  const deferred = {
    start: quote(residenceFraction, delayMonths, false, deferredStartIncome),
    age75: quote(residenceFraction, delayMonths, true, incomeFrom70),
    lifetime: 0,
  };
  const earlyAt70 = quote(residenceFraction, 0, false, incomeFrom70);
  const deferredAt70 = quote(residenceFraction, delayMonths, false, incomeFrom70);

  let clawbackAvoided = 0;
  let earlyNetForgone = 0;
  let gap = 0;
  let discountedGap = 0;
  let simpleBreakEvenAge = null;
  let discountedBreakEvenAge = null;

  for (let month = 0; month < limitMonths; month++) {
    const earlyQuote = month < incomeChangeMonth ? early.start : month < boostMonth ? earlyAt70 : early.age75;
    const deferredQuote = month < incomeChangeMonth ? deferred.start
      : month < boostMonth ? deferredAt70 : deferred.age75;
    const earlyNet = earlyQuote.netMonthly;
    const deferredNet = month < delayMonths ? 0 : deferredQuote.netMonthly;

    if (month < lifetimeMonths) {
      early.lifetime += earlyNet;
      deferred.lifetime += deferredNet;
    }
    if (month < delayMonths) {
      clawbackAvoided += earlyQuote.recoveryAnnual / monthsPerYear;
      earlyNetForgone += earlyNet;
    }

    const yearsElapsed = (month + 1) / monthsPerYear;
    const advantage = deferredNet - earlyNet;
    gap += advantage;
    discountedGap += advantage / (1 + realRate / 100) ** yearsElapsed;

    // A month with a deferred payment advantage is needed to count as a catch-up.
    if (advantage > 0) {
      if (simpleBreakEvenAge === null && gap >= -1e-8) simpleBreakEvenAge = 65 + yearsElapsed;
      if (discountedBreakEvenAge === null && discountedGap >= -1e-8) {
        discountedBreakEvenAge = 65 + yearsElapsed;
      }
    }
  }

  return {
    delayMonths,
    bonusPercent: roundMoney(delayMonths * OAS.monthlyBonus * 100),
    residenceFraction,
    early,
    deferred,
    lifetimeDifference: deferred.lifetime - early.lifetime,
    earlyNetForgone,
    clawbackAvoided,
    simpleBreakEvenAge,
    discountedBreakEvenAge,
    gisWarning: gis && delayMonths > 0,
  };
}
