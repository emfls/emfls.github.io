export const COHORTS = Object.freeze({
  '2025': Object.freeze({ days: 120, reserved: 15, concurrent: 20 }),
  '2026': Object.freeze({ days: 130, reserved: 20, concurrent: 20 }),
});

export const PAY_YEARS = Object.freeze({
  '2025': Object.freeze({ dayCents: 18962, firstRate: 16 }),
  '2026': Object.freeze({ dayCents: 20094, firstRate: 15 }),
});

export const ATI_LIMITS = Object.freeze({
  '2024': Object.freeze({ individual: 180007, family: 373094 }),
  '2025': Object.freeze({ individual: 186487, family: 386525 }),
});

const SUPER_RATE = 12;
const NET_SUPER_SHARE = 85;
const MEDICARE_RATE = 2;

function cents(amount) {
  const rounded = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000 ||
      Math.abs(amount * 100 - rounded) > 0.00001) {
    throw new RangeError('Enter an amount from $0 to $100,000,000 with up to two decimal places.');
  }
  return rounded;
}

export function incomeTest(ati, partnerAti, year) {
  const limits = ATI_LIMITS[year];
  if (!Object.hasOwn(ATI_LIMITS, year)) throw new RangeError('Select a supported ATI year.');
  const ownIncome = cents(ati);
  const familyIncome = ownIncome + cents(partnerAti);
  if (ownIncome <= limits.individual * 100) return 'individual';
  return familyIncome <= limits.family * 100 ? 'family' : 'fails';
}

// Tax is held in hundredths of a cent until the household total is rounded.
function taxUnits(income, firstRate) {
  return Math.min(Math.max(income - 1820000, 0), 2680000) * firstRate
    + Math.min(Math.max(income - 4500000, 0), 9000000) * 30
    + Math.min(Math.max(income - 13500000, 0), 5500000) * 37
    + Math.max(income - 19000000, 0) * 45;
}

// Resident income tax in cents, before Medicare and offsets.
export function residentTax(income, year) {
  if (!Object.hasOwn(PAY_YEARS, year)) throw new RangeError('Select a supported payment year.');
  return Math.round(taxUnits(cents(income), PAY_YEARS[year].firstRate) / 100);
}

export function estimate({
  cohort, payYear, atiYear, partnered, atiA, atiB, incomeA, incomeB, claimA = true, claimB = true,
}) {
  if (!Object.hasOwn(COHORTS, cohort) || !Object.hasOwn(PAY_YEARS, payYear) ||
      !Object.hasOwn(ATI_LIMITS, atiYear) || payYear < cohort || atiYear >= cohort) {
    throw new RangeError('Select compatible birth, payment and ATI years.');
  }

  const { days, reserved } = COHORTS[cohort];
  const { dayCents, firstRate } = PAY_YEARS[payYear];
  const taxableA = cents(incomeA);
  const taxableB = partnered ? cents(incomeB) : 0;
  const statusA = incomeTest(atiA, partnered ? atiB : 0, atiYear);
  const statusB = partnered ? incomeTest(atiB, atiA, atiYear) : null;
  const canClaimA = claimA && statusA !== 'fails';
  const canClaimB = partnered && claimB && statusB !== 'fails';
  const cap = days - (partnered ? reserved : 0);

  const baselineA = canClaimA ? cap : 0;
  const baselineB = canClaimB ? (canClaimA ? reserved : cap) : 0;
  const claimed = baselineA + baselineB;
  const gross = claimed * dayCents;
  const grossSuper = Math.round(gross * SUPER_RATE / 100);
  const netSuper = Math.round(gross * SUPER_RATE * NET_SUPER_SHARE / 10000);
  const existingTax = taxUnits(taxableA, firstRate) + taxUnits(taxableB, firstRate);

  function additionalTax(daysA) {
    return taxUnits(taxableA + daysA * dayCents, firstRate)
      + taxUnits(taxableB + (claimed - daysA) * dayCents, firstRate)
      - existingTax + gross * MEDICARE_RATE;
  }

  let bestDaysA = baselineA;
  const baselineTax = additionalTax(baselineA);
  let bestTax = baselineTax;
  if (canClaimA && canClaimB) {
    for (let daysA = reserved; daysA < cap; daysA += 1) {
      const candidateTax = additionalTax(daysA);
      if (candidateTax < bestTax) {
        bestTax = candidateTax;
        bestDaysA = daysA;
      }
    }
  }

  function allocation(daysA, taxBeforeRounding) {
    const tax = Math.round(taxBeforeRounding / 100);
    const netCash = gross - tax;
    return {
      days: [daysA, claimed - daysA], gross, tax, netCash, grossSuper, netSuper,
      package: netCash + netSuper,
    };
  }

  const baseline = allocation(baselineA, baselineTax);
  const optimal = allocation(bestDaysA, bestTax);
  return { statusA, statusB, unclaimedDays: days - claimed, baseline, optimal, taxSaved: baseline.tax - optimal.tax };
}
