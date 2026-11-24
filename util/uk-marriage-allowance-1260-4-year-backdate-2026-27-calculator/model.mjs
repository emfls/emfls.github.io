export const CURRENT_YEAR = 2026;
export const PRIOR_YEARS = Object.freeze([2022, 2023, 2024, 2025]);
export const ALLOWANCE = 12_570;
export const TRANSFER = Math.ceil(ALLOWANCE * 0.10 / 10) * 10;
export const REDUCED_ALLOWANCE = ALLOWANCE - TRANSFER;
export const MAX_REDUCTION = TRANSFER * 0.20;
export const MAX_INPUT = 1_000_000_000;

// The Scottish intermediate-rate ceiling was unchanged across these five years.
const SCOTTISH_BAND_LIMIT = 31_092;
const REST_OF_UK_BAND_LIMIT = 37_700;

export function claimDeadline(year) {
  return `${year + 5}-04-05`;
}

function toPence(amount) {
  const pence = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_INPUT || pence / 100 !== amount) {
    throw new RangeError('Enter a non-negative amount in pounds and pence.');
  }
  return pence;
}

export function calculateYear(year, {
  donorIncome, recipientIncome, region, qualifyingCouple, recipientBandExtension = 0,
}) {
  if (year !== CURRENT_YEAR && !PRIOR_YEARS.includes(year)) {
    throw new RangeError('Unsupported tax year.');
  }
  if (!['rest', 'scotland'].includes(region) || typeof qualifyingCouple !== 'boolean') {
    throw new RangeError('Choose a tax region and confirm your relationship status.');
  }

  const donor = toPence(donorIncome);
  const recipient = toPence(recipientIncome);
  const extension = toPence(recipientBandExtension);
  const recipientTaxable = recipient - ALLOWANCE * 100;
  const scotland = region === 'scotland';
  const bandLimit = (scotland ? SCOTTISH_BAND_LIMIT : REST_OF_UK_BAND_LIMIT) * 100 + extension;
  const zero = { year, transfer: 0, donorAllowance: ALLOWANCE, recipientSaving: 0, donorCost: 0, netSaving: 0 };

  if (!qualifyingCouple) return { ...zero, status: 'couple' };
  if (donor > ALLOWANCE * 100) return { ...zero, status: 'donor-limit' };
  if (recipientTaxable <= 0) return { ...zero, status: 'no-recipient-tax' };
  if (recipientTaxable > bandLimit) return { ...zero, status: 'recipient-limit' };

  // Donor income above the reduced allowance fits wholly in the first band.
  const donorTaxable = Math.max(0, donor - REDUCED_ALLOWANCE * 100);
  const donorPence = Math.floor(donorTaxable * (scotland ? 19 : 20) / 100);
  // Relief caps out within the first band in every supported year. Once the
  // taxable income reaches that cap, the remaining bands cannot affect it.
  const recipientPence = Math.min(
    MAX_REDUCTION * 100,
    Math.floor(recipientTaxable * (scotland ? 19 : 20) / 100),
  );

  return {
    year, status: 'eligible', transfer: TRANSFER, donorAllowance: REDUCED_ALLOWANCE,
    recipientSaving: recipientPence / 100, donorCost: donorPence / 100,
    netSaving: (recipientPence - donorPence) / 100,
  };
}

export function calculateClaim(currentInputs, priorInputs = {}, claimDate = '2026-04-06') {
  const parsed = new Date(claimDate);
  if (typeof claimDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(claimDate)
      || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== claimDate) {
    throw new RangeError('Enter a valid claim date.');
  }
  if (Object.keys(priorInputs).some(year => !PRIOR_YEARS.some(prior => String(prior) === year))) {
    throw new RangeError('Unsupported backdate year.');
  }

  const current = calculateYear(CURRENT_YEAR, currentInputs);
  const prior = PRIOR_YEARS.filter(year => Object.hasOwn(priorInputs, year)).map(year => {
    if (claimDate > claimDeadline(year)) {
      return { year, status: 'expired', recipientSaving: 0, donorCost: 0, netSaving: 0 };
    }
    return calculateYear(year, priorInputs[year]);
  });

  const recipientPence = prior.reduce((sum, row) => sum + Math.round(row.recipientSaving * 100), 0);
  const donorPence = prior.reduce((sum, row) => sum + Math.round(row.donorCost * 100), 0);
  const netPence = recipientPence - donorPence;
  return {
    current, prior, priorRecipientSaving: recipientPence / 100, priorDonorCost: donorPence / 100,
    priorNetSaving: netPence / 100, combinedNetSaving: (netPence + Math.round(current.netSaving * 100)) / 100,
  };
}
