const DAY = 86_400_000;
const BASIC_BRACKETS = [[55_000, 50], [250_000, 100], [400_000, 150]];
const HIGH_VALUE_CUTOFFS = [4_000_000, 5_000_000, 10_000_000, 20_000_000, Infinity];
const TORONTO_EARLY_RATES = [350, 450, 550, 650, 750];
const TORONTO_APRIL_RATES = [440, 545, 650, 755, 860];
const ELIGIBLE = 'ELIGIBLE_FULL_25_PCT_REBATE';

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date.getTime();
}

function formatDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function graduatedTax(priceCents, brackets) {
  let previousCap = 0;
  let weightedCents = 0;
  for (const [upperLimit, basisPoints] of brackets) {
    const cap = Math.min(priceCents, upperLimit * 100);
    weightedCents += (cap - previousCap) * basisPoints;
    if (cap === priceCents) break;
    previousCap = cap;
  }
  return Math.round(weightedCents / 10_000);
}

export function canCertifyExemption(buyer, title, residences) {
  if (residences < 1 || residences > 6 || !['foreign', 'nominee', 'protected'].includes(buyer)) {
    return false;
  }
  const qualifyingSpouse = ['eligible-spouse', 'eligible-spouse-and-others'].includes(title);
  // A nominee or protected person's foreign spouse can qualify through them.
  return qualifyingSpouse || (buyer !== 'foreign' && ['sole', 'spouse', 'eligible-others'].includes(title));
}

/** Gross taxes for a standard registered 2026 conveyance, in CAD. */
export function calculateClosingTaxes({
  price, registration, location, residences, buyer, title, certifiedOccupancy,
}) {
  const priceCents = Math.round(price * 100);
  if (!Number.isFinite(price) || price <= 0 || price > 1e9 || priceCents / 100 !== price) {
    return { error: 'price' };
  }
  if (parseDate(registration) === null || !registration.startsWith('2026-')) {
    return { error: 'registration' };
  }
  if (!['ontario', 'toronto'].includes(location)) return { error: 'location' };
  if (!Number.isSafeInteger(residences) || residences < 0) return { error: 'residences' };
  if (!['domestic', 'foreign', 'nominee', 'protected', 'entity'].includes(buyer)) {
    return { error: 'buyer' };
  }
  if (!['sole', 'spouse', 'eligible-spouse', 'eligible-spouse-and-others',
    'eligible-others', 'other'].includes(title)) return { error: 'title' };

  const singleFamilyTier = residences === 1 || residences === 2;
  const lowerBrackets = [...BASIC_BRACKETS, [2_000_000, 200]];
  const generalBrackets = [...BASIC_BRACKETS, [Infinity, 200]];
  const provincialBrackets = singleFamilyTier ? [...lowerBrackets, [Infinity, 250]] : generalBrackets;
  const luxuryRates = registration < '2026-04-01' ? TORONTO_EARLY_RATES : TORONTO_APRIL_RATES;
  const cityBrackets = singleFamilyTier ? [
    ...lowerBrackets,
    [3_000_000, 250],
    ...HIGH_VALUE_CUTOFFS.map((cap, i) => [cap, luxuryRates[i]]),
  ] : generalBrackets;

  const exempt = certifiedOccupancy === true && canCertifyExemption(buyer, title, residences);
  const taxable = residences >= 1 && residences <= 6 && buyer !== 'domestic' && !exempt;
  const inToronto = location === 'toronto';

  const nrst = taxable ? Math.round(priceCents / 4) : 0;
  const mnrst = taxable && inToronto ? Math.round(priceCents / 10) : 0;
  const ontario = graduatedTax(priceCents, provincialBrackets);
  const toronto = inToronto ? graduatedTax(priceCents, cityBrackets) : 0;
  const totalCents = nrst + mnrst + ontario + toronto;
  return {
    registration, buyer, title, nrst: nrst / 100, torontoMnrst: mnrst / 100,
    ontarioLtt: ontario / 100, torontoMltt: toronto / 100,
    landTransferTax: (ontario + toronto) / 100, total: totalCents / 100,
    effectiveRate: totalCents / priceCents * 100,
  };
}

/** Projected Ontario PR rebate, assuming the closing NRST is paid. */
export function evaluatePrRebate(taxes, {
  prDate, moveInDate, applicationDate, continuousOccupancy, continuousTitle,
}) {
  const { registration, title, buyer, nrst } = taxes;
  const closing = parseDate(registration);
  if (closing === null) return null;

  if (buyer === 'entity' || nrst === 0) {
    return {
      status: 'DISQUALIFIED', amount: 0,
      reasons: [buyer === 'entity' ? 'entity' : 'tax-not-due'],
    };
  }

  const reasons = [];
  const [year, month, day] = registration.split('-').map(Number);
  const fourthAnniversary = Date.UTC(year + 4, month - 1, day);
  const moveInLimit = closing + 60 * DAY;
  const pr = parseDate(prDate);
  const moveIn = parseDate(moveInDate);
  const application = parseDate(applicationDate);
  const filingLimit = pr === null ? null : Math.min(pr, fourthAnniversary) + 180 * DAY;

  if (!['sole', 'spouse', 'eligible-spouse'].includes(title)) reasons.push('title');
  else if (continuousTitle !== true) reasons.push('title-interrupted');

  if (pr === null) reasons.push('pr-missing');
  else if (pr <= closing) reasons.push('pr-before-registration');
  else if (pr >= fourthAnniversary) reasons.push('pr-late');

  if (moveIn === null) reasons.push('move-in-missing');
  else if (moveIn < closing) reasons.push('move-in-before-registration');
  else if (moveIn > moveInLimit) reasons.push('move-in-late');
  if (continuousOccupancy !== true) reasons.push('occupancy-interrupted');

  if (application === null) reasons.push('application-missing');
  else {
    if (pr !== null && application < pr) reasons.push('filing-before-pr');
    if (moveIn !== null && application < moveIn) reasons.push('filing-before-occupancy');
    if (filingLimit !== null && application > filingLimit) reasons.push('filing-late');
  }

  return {
    status: reasons.length ? 'DISQUALIFIED' : ELIGIBLE,
    reasons,
    amount: reasons.length ? 0 : nrst,
    fourYearAnniversary: formatDate(fourthAnniversary),
    moveInDeadline: formatDate(moveInLimit),
    filingDeadline: filingLimit === null ? null : formatDate(filingLimit),
    registration, applicationDate,
  };
}

/** Interest-only financing on the entire NRST balance, simple actual/365. */
export function calculateCarryingCost(nrst, annualRate, delayDays, rebate) {
  if (rebate?.status !== ELIGIBLE || !Number.isFinite(nrst) || nrst <= 0 ||
      !Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100 ||
      !Number.isInteger(delayDays) || delayDays < 0 || delayDays > 3650) return null;
  const receipt = parseDate(rebate.applicationDate) + delayDays * DAY;
  const days = (receipt - parseDate(rebate.registration)) / DAY;
  const interestCents = Math.round(nrst * annualRate * days / 365);
  return { days, receiptDate: formatDate(receipt), interest: interestCents / 100 };
}
