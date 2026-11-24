export const HOURLY_CAPS = Object.freeze({
  belowSchool: 15.19,
  schoolAge: 13.30,
  familyDay: 14.08,
  inHome: 41.31,
});

function requireRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter ${label} between ${min} and ${max}.`);
  }
}

export function standardRate(ati) {
  requireRange(ati, 0, Number.MAX_SAFE_INTEGER, 'combined family ATI');
  // Calculate in hundredths of a percentage point for statutory rounding.
  return Math.round(Math.max(0, Math.min(9000, 9000 - (ati - 88520) / 50))) / 100;
}

export function higherSiblingRate(ati) {
  const standard = standardRate(ati);
  if (ati >= 370727) return standard;
  if (ati >= 360727) return Math.max(standard, 50);
  if (ati >= 270727) return Math.max(standard, Math.round(8000 - (ati - 270727) / 30) / 100);
  if (ati >= 191437) return Math.max(standard, 80);
  return Math.max(standard, Math.round(Math.min(9500, 9500 - (ati - 146437) / 30)) / 100);
}

export function calculateCCS({
  ati, careType, dailyFee, sessionHours, daysPerWeek, children,
  youngChildren = children, hoursTier, withholding = 5,
}) {
  if (!Object.hasOwn(HOURLY_CAPS, careType)) throw new RangeError('Choose a care type.');
  requireRange(dailyFee, 0, 1000000, 'the daily fee');
  requireRange(sessionHours, 0.01, 24, 'the booked hours per session');
  requireRange(withholding, 0, 100, 'the withholding percentage');
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 5) {
    throw new RangeError('Choose 1 to 5 days per week.');
  }
  if (!Number.isInteger(children) || children < 1 || children > 3) {
    throw new RangeError('Choose 1 to 3 children.');
  }
  if (!Number.isInteger(youngChildren) || youngChildren < 0 || youngChildren > children) {
    throw new RangeError('Check how many children are aged 5 or younger.');
  }
  if (hoursTier !== 72 && hoursTier !== 100) throw new RangeError('Choose 72 or 100 hours.');

  const inHome = careType === 'inHome';
  const feeUnits = inHome ? 1 : children;
  const higherRateChildren = inHome ? 0 : Math.max(0, youngChildren - 1);
  const standard = standardRate(ati);
  const higher = higherRateChildren ? higherSiblingRate(ati) : standard;
  const cap = HOURLY_CAPS[careType];
  const hourlyFee = dailyFee / sessionHours;
  const hourlyBase = Math.min(hourlyFee, cap);
  const familyHourlyCCS = hourlyBase *
    ((feeUnits - higherRateChildren) * standard + higherRateChildren * higher) / 100;

  function fortnight(days) {
    const bookedHours = days * 2 * sessionHours;
    const subsidisedHours = Math.min(bookedHours, hoursTier);
    const fees = days * 2 * dailyFee * feeUnits;
    const grossCCS = Math.min(fees, subsidisedHours * familyHourlyCCS);
    const withheld = grossCCS * withholding / 100;
    const paidCCS = grossCCS - withheld;
    return {
      bookedHours, subsidisedHours, unsubsidisedHours: bookedHours - subsidisedHours,
      fees, grossCCS, withheld, paidCCS,
      outOfPocket: fees - paidCCS,
      gapBeforeWithholding: fees - grossCCS,
    };
  }

  const selected = fortnight(daysPerWeek);
  const threeDays = fortnight(3);
  const fourDays = fortnight(4);
  const fiveDays = fortnight(5);

  return {
    hourlyFee, cap, hourlyGap: Math.max(0, hourlyFee - cap), hourlyBase,
    standard, higher, higherRateChildren,
    fortnight: selected,
    annual: {
      grossCCS: selected.grossCCS * 26,
      paidCCS: selected.paidCCS * 26,
      withheld: selected.withheld * 26,
      outOfPocket: selected.outOfPocket * 26,
      gapBeforeWithholding: selected.gapBeforeWithholding * 26,
    },
    weeklyOutOfPocket: selected.outOfPocket / 2,
    fourthDayCost: (fourDays.outOfPocket - threeDays.outOfPocket) / 2,
    fifthDayCost: (fiveDays.outOfPocket - fourDays.outOfPocket) / 2,
  };
}
