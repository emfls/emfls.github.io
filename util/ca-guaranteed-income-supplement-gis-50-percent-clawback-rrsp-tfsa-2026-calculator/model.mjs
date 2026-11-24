export const GIS = Object.freeze({
  single: Object.freeze({ monthlyMaximum: 1138.90, cutoff: 23112, recipients: 1 }),
  bothOas: Object.freeze({ monthlyMaximum: 685.56, cutoff: 30528, recipients: 2 }),
  allowance: Object.freeze({ monthlyMaximum: 685.56, cutoff: 42768, recipients: 1 }),
  neither: Object.freeze({ monthlyMaximum: 1138.90, cutoff: 55392, recipients: 1 }),
});

export const MAX_AMOUNT = 10000000;

// Service Canada, October–December 2026, Tables 1–4 (2025 assessment income).
// https://open.canada.ca/data/en/dataset/dfa4daf1-669e-4514-82cd-982f27707ed0
// Each segment lists [starting income in dollars, first monthly payment in cents,
// cents lost per band, repeating band widths in dollars].
const paymentBands = {
  single: [
    [0, 113890, 100, [24]],
    [2040, 105390, 100, [8, 16, 24]],
    [10496, 52549, 0, [16]],
    [10512, 52449, 100, [24]],
  ],
  bothOas: [
    [0, 68556, 100, [48]],
    [4080, 60056, 100, [16, 32, 48]],
    [8800, 45257, 0, [32]],
    [8832, 45157, 100, [48]],
  ],
  neither: [
    [0, 113890, 0, [4096]],
    [4096, 113790, 100, [96]],
    [9184, 108490, 0, [32]],
    [9216, 108390, 100, [48, 16, 32]],
    [20992, 71649, 0, [32]],
    [21024, 71549, 100, [48]],
  ],
  allowance: [
    [0, 68556, 0, [4096]],
    [4096, 68456, 100, [96]],
    [8800, 63557, 0, [3488]],
    [12288, 63457, 100, [48]],
    [30144, 26292, 0, [48]],
  ],
};

function requireCategory(category) {
  if (typeof category !== 'string' || !Object.hasOwn(GIS, category)) {
    throw new RangeError('Choose a valid household category.');
  }
}

function scaledAmount(value, maximum, label) {
  const scaled = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > maximum || scaled / 100 !== value) {
    throw new RangeError(label + ' must be between 0 and ' + maximum.toLocaleString('en-CA') + ' with up to two decimal places.');
  }
  return scaled;
}

// A cent in the 50% exemption band produces half a cent of exemption.
// Retain that precision through the eligibility lookup.
function exemptHalfCents(earningsCents) {
  return 2 * Math.min(earningsCents, 500000)
    + Math.min(1000000, Math.max(0, earningsCents - 500000));
}

export function employmentExemption(earnings) {
  return exemptHalfCents(scaledAmount(earnings, MAX_AMOUNT, 'Employment income')) / 200;
}

function monthlyPaymentCents(category, income) {
  // Table 4 directs households past the Allowance limit to Table 3 for GIS.
  if (category === 'allowance' && income >= GIS.allowance.cutoff) category = 'neither';
  if (income >= GIS[category].cutoff) return 0;

  const [start, firstPayment, drop, widths] = paymentBands[category].findLast(([start]) => start <= income);
  const cycleWidth = widths.reduce((sum, width) => sum + width, 0);
  const offset = income - start;
  let bands = Math.floor(offset / cycleWidth) * widths.length;
  let remainder = offset % cycleWidth;
  for (const width of widths) {
    if (remainder < width) break;
    remainder -= width;
    bands++;
  }
  return firstPayment - bands * drop;
}

export function monthlyGis(category, assessableIncome) {
  requireCategory(category);
  if (!Number.isFinite(assessableIncome) || assessableIncome < 0) {
    throw new RangeError('Enter non-negative assessable income.');
  }
  return monthlyPaymentCents(category, assessableIncome) / 100;
}

export function compareWithdrawals({
  category, otherIncome, employment, partnerEmployment = 0, withdrawal, taxRate, earlyTaxRate = taxRate,
}) {
  requireCategory(category);
  const pensionCents = scaledAmount(otherIncome, MAX_AMOUNT, 'CPP, pension and investment income');
  const earnedCents = scaledAmount(employment, MAX_AMOUNT, 'Employment income');
  const partnerCents = category === 'single' ? 0 : scaledAmount(partnerEmployment, MAX_AMOUNT, 'Partner employment income');
  const withdrawalCents = scaledAmount(withdrawal, MAX_AMOUNT, 'Withdrawal');
  const taxBasisPoints = scaledAmount(taxRate, 100, 'Retirement tax rate');
  const earlyTaxBasisPoints = scaledAmount(earlyTaxRate, 100, 'Pre-65 tax rate');

  const exempt = exemptHalfCents(earnedCents) + exemptHalfCents(partnerCents);
  const incomeHalfCents = 2 * (pensionCents + earnedCents + partnerCents) - exempt;
  const assessableIncome = incomeHalfCents / 200;
  const rrspAssessableIncome = (incomeHalfCents + 2 * withdrawalCents) / 200;
  const annualFactor = 12 * GIS[category].recipients;
  const baseline = monthlyPaymentCents(category, assessableIncome) * annualFactor;
  const withRrsp = monthlyPaymentCents(category, rrspAssessableIncome) * annualFactor;
  const loss = baseline - withRrsp;
  const rrspTax = Math.round(withdrawalCents * taxBasisPoints / 10000);
  const earlyRrspTax = Math.round(withdrawalCents * earlyTaxBasisPoints / 10000);
  const extraCost = loss + rrspTax;

  return {
    exemptEarnings: exempt / 200,
    assessableIncome,
    rrspAssessableIncome,
    baselineGis: baseline / 100,
    rrspGis: withRrsp / 100,
    tfsaGis: baseline / 100,
    gisLost: loss / 100,
    rrspTax: rrspTax / 100,
    tfsaGisLost: 0,
    tfsaTax: 0,
    rrspNet: (withdrawalCents - extraCost) / 100,
    tfsaNet: withdrawalCents / 100,
    effectiveRate: withdrawalCents ? 100 * extraCost / withdrawalCents : null,
    annualTfsaAdvantage: extraCost / 100,
    tenYearTfsaAdvantage: extraCost * 10 / 100,
    earlyRrspTax: earlyRrspTax / 100,
    earlyRrspNet: (withdrawalCents - earlyRrspTax) / 100,
    earlyRrspAdvantage: (extraCost - earlyRrspTax) / 100,
  };
}
