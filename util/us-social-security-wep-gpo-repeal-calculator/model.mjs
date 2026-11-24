const MAX_CENTS = 10_000_000_000;
const roundRatio = (n, d) => Math.floor((n + d / 2) / d);

export function checkInteger(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(name + ' is outside the supported range.');
  }
  return value;
}

export function parseCents(value) {
  const match = /^([+-]?)([0-9]{1,9})(?:[.]([0-9]{1,2}))?$/.exec(String(value).trim());
  if (!match) throw new RangeError('Enter a number with up to two decimal places.');
  const cents = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return checkInteger(match[1] === '-' && cents ? -cents : cents, -MAX_CENTS, MAX_CENTS, 'Amount');
}

export const FIRST_RESTORED_MONTH = '2024-01';
export const BEND_POINT_2024 = 117400;

export function calculateRepeal({
  mode, fullBenefit, nonCoveredPension = 0, previousWepReduction = 0,
  aime = 0, years = 20, months = 0,
}) {
  if (!['exact', 'estimate', 'gpo'].includes(mode)) throw new RangeError('Choose a repeal mode.');
  checkInteger(fullBenefit, 0, MAX_CENTS, 'Full monthly benefit');
  checkInteger(months, 0, 36, 'Eligible months');
  let reduction;
  if (mode === 'exact') {
    reduction = checkInteger(previousWepReduction, 0, MAX_CENTS, 'Prior WEP reduction');
  } else {
    checkInteger(nonCoveredPension, 0, MAX_CENTS, 'Monthly pension');
    if (mode === 'gpo') {
      reduction = roundRatio(nonCoveredPension * 2, 3);
    } else {
      checkInteger(aime, 0, MAX_CENTS, 'Monthly indexed earnings');
      checkInteger(years, 0, 30, 'Years of substantial earnings');
      const wepFactor = 40 + 5 * Math.max(0, years - 20);
      const formula = roundRatio(Math.min(aime, BEND_POINT_2024) * (90 - wepFactor), 100);
      reduction = Math.min(formula, Math.floor(nonCoveredPension / 2));
    }
  }
  const monthlyIncrease = Math.min(fullBenefit, reduction);
  return {
    monthlyIncrease, oldMonthlyBenefit: fullBenefit - monthlyIncrease, newMonthlyBenefit: fullBenefit,
    annualIncrease: monthlyIncrease * 12, retroactiveIncrease: monthlyIncrease * months,
    tenYearIncrease: monthlyIncrease * 120, firstRestoredMonth: FIRST_RESTORED_MONTH,
  };
}
