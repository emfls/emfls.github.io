export const RRSP_2026 = Object.freeze({
  annualLimit: 33_810,
  earnedIncomeRate: 0.18,
  contributionWindowStart: '2026-03-03',
  first60DaysStart: '2027-01-01',
  deadline: '2027-03-01',
});

const MAX_DOLLARS = 1_000_000_000;

function hundredths(value, label, max) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(`${label} must be between 0 and ${max.toLocaleString('en-CA')}.`);
  }
  const scaled = Math.round(value * 100);
  if (scaled / 100 !== value) {
    throw new RangeError(`${label} can have up to two decimal places.`);
  }
  return scaled;
}

function calendarYear(date, label, maxYear = 9999) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const year = Number(date.slice(0, 4));
    const parsed = new Date(`${date}T00:00:00Z`);
    if (year >= 1000 && year <= maxYear && Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date) {
      return year;
    }
  }
  throw new RangeError(`Enter a valid ${label} date (YYYY-MM-DD, year 1000–${maxYear}).`);
}

// Inputs use dollars, percentage points and ISO calendar dates.
// One withdrawal type per scenario and no contributions previously attributed.
export function calculateAttribution({
  contributionDate,
  contributionAmount,
  availableRoom,
  contributorRate,
  spouseRate,
  withdrawalDate,
  withdrawalAmount,
  rrif = false,
  rrifMinimum = 0,
  otherContributions = [],
}) {
  const year = calendarYear(withdrawalDate, 'withdrawal');
  const contributionYear = calendarYear(contributionDate, 'contribution', 9996);
  const amount = hundredths(contributionAmount, 'Contribution amount', MAX_DOLLARS);
  const room = hundredths(availableRoom, 'Available deduction room', MAX_DOLLARS);
  const contributorBasisPoints = hundredths(contributorRate, 'Contributor tax rate', 100);
  const spouseBasisPoints = hundredths(spouseRate, 'Annuitant tax rate', 100);
  const withdrawal = hundredths(withdrawalAmount, 'Withdrawal amount', MAX_DOLLARS);
  const minimum = rrif ? hundredths(rrifMinimum, 'RRIF minimum', MAX_DOLLARS) : 0;
  const exempt = Math.min(withdrawal, minimum);
  const eligibleWithdrawal = withdrawal - exempt;
  const lookbackYears = [year - 2, year - 1, year];

  const contributions = [{ year: contributionYear, cents: amount }];
  for (const other of otherContributions) {
    contributions.push({
      year: calendarYear(other.date, 'additional contribution', 9996),
      cents: hundredths(other.amount, 'Additional contribution amount', MAX_DOLLARS),
    });
  }

  let latestYear = null;
  let attributed = 0;
  for (const contribution of contributions) {
    if (contribution.cents === 0) continue;
    latestYear = Math.max(latestYear ?? contribution.year, contribution.year);
    // A contribution later in the withdrawal year still counts.
    if (lookbackYears.includes(contribution.year)) {
      attributed += Math.min(contribution.cents, eligibleWithdrawal - attributed);
    }
  }

  const spouseIncome = withdrawal - attributed;
  const rateSpread = contributorBasisPoints - spouseBasisPoints;
  const inContributionWindow = contributionDate >= RRSP_2026.contributionWindowStart &&
    contributionDate <= RRSP_2026.deadline;
  const deductible = Math.min(amount, room);
  const taxDollars = (units) => (Math.sign(units) * Math.round(Math.abs(units) / 10_000) || 0) / 100;

  return {
    status: attributed > 0 ? 'attributed' : withdrawal > 0 ? 'safe' : 'no-withdrawal',
    lookbackYears,
    earliestDate: latestYear === null ? null : `${latestYear + 3}-01-01`,
    first60Days: inContributionWindow && contributionDate >= RRSP_2026.first60DaysStart,
    deductibleAmount: inContributionWindow ? deductible / 100 : null,
    aboveRoom: inContributionWindow ? (amount - deductible) / 100 : null,
    deductionBenefit: inContributionWindow ? taxDollars(deductible * contributorBasisPoints) : null,
    contributorIncome: attributed / 100,
    spouseIncome: spouseIncome / 100,
    rrifExemptAmount: exempt / 100,
    withdrawalTax: taxDollars(attributed * contributorBasisPoints + spouseIncome * spouseBasisPoints),
    splittingSavings: taxDollars(spouseIncome * rateSpread),
    extraTax: taxDollars(attributed * rateSpread),
  };
}
