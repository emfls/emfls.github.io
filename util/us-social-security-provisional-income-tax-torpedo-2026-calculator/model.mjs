const thresholds = {
  single: { lower: 25000, upper: 34000 },
  mfj: { lower: 32000, upper: 44000 },
  mfs_together: { lower: 0, upper: 0 },
};

const marginalRates = [0.10, 0.12, 0.22, 0.24];
const maximumInput = 1_000_000_000;
const nextWithdrawal = 1_000;

function taxableBenefits(provisionalIncome, annualSocialSecurity, { lower, upper }) {
  if (annualSocialSecurity <= 0) return 0;

  const tierOneIncome = Math.max(0, Math.min(provisionalIncome, upper) - lower);
  const tierTwoIncome = Math.max(0, provisionalIncome - upper);
  const tierOneBenefits = Math.min(0.5 * annualSocialSecurity, 0.5 * tierOneIncome);
  return Math.min(0.85 * annualSocialSecurity, tierOneBenefits + 0.85 * tierTwoIncome);
}

export function calculateBenefits({
  filingStatus,
  annualSocialSecurity,
  nonSsAgi,
  taxExemptMuniInterest,
}) {
  if (!Object.hasOwn(thresholds, filingStatus)) {
    throw new RangeError('Choose a filing status.');
  }

  const incomes = [annualSocialSecurity, nonSsAgi, taxExemptMuniInterest];
  if (incomes.some(amount => !Number.isFinite(amount) || Math.abs(amount) > maximumInput)
      || taxExemptMuniInterest < 0) {
    throw new RangeError('Enter valid annual income amounts.');
  }

  const halfBenefits = annualSocialSecurity / 2;
  const provisionalIncome = nonSsAgi + taxExemptMuniInterest + halfBenefits;
  const taxableSocialSecurity = taxableBenefits(provisionalIncome, annualSocialSecurity, thresholds[filingStatus]);

  return {
    provisionalIncome,
    taxableSocialSecurity,
    taxableShare: annualSocialSecurity > 0 ? taxableSocialSecurity / annualSocialSecurity : 0,
  };
}

export function simulateWithdrawal(input) {
  const { marginalRate, plannedWithdrawal } = input;
  if (!marginalRates.includes(marginalRate)) {
    throw new RangeError('Choose a federal marginal rate.');
  }
  if (!Number.isFinite(plannedWithdrawal) || plannedWithdrawal < 1000 || plannedWithdrawal > 20000) {
    throw new RangeError('Enter a planned withdrawal from $1,000 to $20,000.');
  }

  const baseline = calculateBenefits(input);

  function compare(amount) {
    // The withdrawal changes combined income dollar for dollar. Use the
    // worksheet again to capture threshold crossings and capped benefits.
    const taxableAfter = taxableBenefits(
      baseline.provisionalIncome + amount,
      input.annualSocialSecurity,
      thresholds[input.filingStatus],
    );
    const addedTaxableBenefits = taxableAfter - baseline.taxableSocialSecurity;
    return {
      taxableAfter,
      addedTaxableBenefits,
      tax: marginalRate * (amount + addedTaxableBenefits),
    };
  }

  const next = compare(nextWithdrawal);
  const planned = compare(plannedWithdrawal);
  return {
    ...baseline,
    nextThousandTax: next.tax,
    nextThousandRate: next.tax / nextWithdrawal,
    plannedTaxableSocialSecurity: planned.taxableAfter,
    plannedAddedTaxableSocialSecurity: planned.addedTaxableBenefits,
    plannedTraditionalTax: planned.tax,
    plannedAlternativeTax: 0,
    plannedTaxSaved: planned.tax,
  };
}
