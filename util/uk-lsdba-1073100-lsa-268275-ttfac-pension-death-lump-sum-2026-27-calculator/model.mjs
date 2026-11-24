export const LIMITS = Object.freeze({
  standard_268275_1073100: Object.freeze({ lsa: 268275, lsdba: 1073100, lta: 1073100 }),
  fp2016_312500_1250000: Object.freeze({ lsa: 312500, lsdba: 1250000, lta: 1250000 }),
});

const EVENTS = ['lifetime_pcls', 'death_under_75_lump_sum', 'death_75_plus'];
const CERTIFICATE_STATUSES = ['window_open', 'window_closed', 'in_force', 'unknown'];

function scaled(value, label, max = 1_000_000_000, min = 0) {
  if (!Number.isFinite(value) || value < min || value > max || Number(value.toFixed(2)) !== value) {
    throw new RangeError(`${label} must be between ${min.toLocaleString('en-GB')} and ${max.toLocaleString('en-GB')}, with up to two decimal places.`);
  }
  return Math.round(value * 100);
}

function payment(lsa, lsdba, plannedCash, event, rate, lateUnder75Payment) {
  let ceiling = 0;
  if (event === 'lifetime_pcls') ceiling = Math.min(lsa, lsdba);
  if (event === 'death_under_75_lump_sum' && !lateUnder75Payment) ceiling = lsdba;
  const taxFree = Math.min(ceiling, plannedCash);
  const taxable = plannedCash - taxFree;
  return { lsa, lsdba, taxFree, taxable, tax: Math.round(taxable * rate / 100) };
}

function verdictFor({ certificateStatus, priorCash, ltaUsed, event, lateUnder75Payment, delta }) {
  if (certificateStatus === 'in_force') return 'CERTIFICATE_IN_FORCE';
  if (certificateStatus === 'window_closed' || priorCash > 0) return 'APPLICATION_UNAVAILABLE';
  if (ltaUsed === 0) return 'NO_PRIOR_LTA_USE';
  if (certificateStatus === 'unknown') return 'CHECK_ELIGIBILITY';
  if (event === 'death_75_plus' || (event === 'death_under_75_lump_sum' && lateUnder75Payment)) {
    return 'NO_EVENT_TAX_BENEFIT';
  }
  const improves = delta.lsa > 0 || delta.lsdba > 0;
  const worsens = delta.lsa < 0 || delta.lsdba < 0;
  if (improves && worsens) return 'REVIEW_TRADE_OFF';
  if (worsens) return 'DO_NOT_APPLY_WORSE_OFF';
  return improves ? 'APPLY_FOR_TTFAC' : 'DO_NOT_APPLY_NO_GAIN';
}

function asPounds(result) {
  return Object.fromEntries(Object.entries(result).map(([key, pence]) => [key, pence / 100]));
}

/** Monetary inputs and outputs are pounds. All arithmetic uses integer pence. */
export function calculate({
  regime, customLsa, customLsdba, customLta, ltaUsed, historicCash, priorCash, amount,
  historicLsdbaOnly = 0, priorLsdbaOnly = 0, event, rate, certificateStatus = 'unknown',
  fullLsdbaDeduction = false, lateUnder75Payment = false,
}) {
  if (!EVENTS.includes(event) || ![20, 40, 45].includes(rate) ||
      !CERTIFICATE_STATUSES.includes(certificateStatus) ||
      typeof fullLsdbaDeduction !== 'boolean' || typeof lateUnder75Payment !== 'boolean') {
    throw new RangeError('Choose a supported payment type, tax rate and certificate status.');
  }

  let lsa, lsdba, lta;
  if (regime === 'custom') {
    lsa = scaled(customLsa, 'Protected LSA');
    lsdba = scaled(customLsdba, 'Protected LSDBA');
    lta = scaled(customLta, 'Historic protected lifetime allowance', 1_000_000_000, 0.01);
    if (lsa > lsdba) throw new RangeError('The protected LSA cannot exceed the protected LSDBA.');
  } else {
    if (!Object.hasOwn(LIMITS, regime)) throw new RangeError('Choose a supported protection regime.');
    lsa = LIMITS[regime].lsa * 100;
    lsdba = LIMITS[regime].lsdba * 100;
    lta = LIMITS[regime].lta * 100;
  }

  const usedBasisPoints = scaled(ltaUsed, 'Historic LTA used (%)', 100);
  const historicLsaUse = scaled(historicCash, 'Historic tax-free pension cash');
  const historicLsdbaUse = historicLsaUse + scaled(historicLsdbaOnly, 'Additional historic LSDBA use');
  const priorLsaUse = scaled(priorCash, 'Tax-free pension cash already drawn');
  const priorLsdbaUse = priorLsaUse + scaled(priorLsdbaOnly, 'Additional post-2024 LSDBA use');
  const totalAmount = scaled(amount, 'Planned amount');
  if (usedBasisPoints === 0 && historicLsdbaUse > 0) {
    throw new RangeError('Enter the historic LTA percentage corresponding to the historic tax-free cash.');
  }

  const fullyUsed = usedBasisPoints === 10000;
  const standardLsaUse = Math.round(lta * usedBasisPoints / 40000);
  const standardLsdbaUse = Math.round(lta * usedBasisPoints / (fullLsdbaDeduction ? 10000 : 40000));
  const plannedCash = event === 'lifetime_pcls' ? Math.round(totalAmount / 4) : totalAmount;
  const standard = payment(
    fullyUsed ? 0 : Math.max(0, lsa - standardLsaUse - priorLsaUse),
    fullyUsed ? 0 : Math.max(0, lsdba - standardLsdbaUse - priorLsdbaUse),
    plannedCash, event, rate, lateUnder75Payment,
  );
  const ttfac = payment(
    Math.max(0, lsa - historicLsaUse - priorLsaUse),
    Math.max(0, lsdba - historicLsdbaUse - priorLsdbaUse),
    plannedCash, event, rate, lateUnder75Payment,
  );
  const delta = {
    lsa: ttfac.lsa - standard.lsa,
    lsdba: ttfac.lsdba - standard.lsdba,
    taxFree: ttfac.taxFree - standard.taxFree,
  };

  return {
    standard: asPounds(standard), ttfac: asPounds(ttfac), delta: asPounds(delta),
    plannedCash: plannedCash / 100,
    verdict: verdictFor({ certificateStatus, priorCash, ltaUsed, event, lateUnder75Payment, delta }),
  };
}
