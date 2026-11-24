const TAX_RATES = {
  adult_child_direct: [0.17, 0.32],
  adult_child_estate: [0.15, 0.30],
  tax_dependant: [0, 0]
};

function moneyInCents(amount, label) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`${label} must be a non-negative amount.`);
  }
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || cents / 100 !== amount) {
    throw new RangeError(`${label} must be a supported dollar amount with up to two decimal places.`);
  }
  return cents;
}

export function bringForwardCap(totalSuperBalance) {
  const tsb = moneyInCents(totalSuperBalance, 'Total super balance at 30 June');
  if (tsb < 184_000_000) return { cap: 390_000, years: 3 };
  if (tsb < 197_000_000) return { cap: 260_000, years: 2 };
  if (tsb < 210_000_000) return { cap: 130_000, years: 1 };
  return { cap: 0, years: 0 };
}

function deathTax(components, beneficiary) {
  const [taxedRate, untaxedRate] = TAX_RATES[beneficiary];
  return components.taxedElement * taxedRate + components.untaxedElement * untaxedRate;
}

export function estimateDeathBenefit({
  totalBalance, taxFree, taxedElement, untaxedElement, beneficiary, age, cycles,
  priorTsb, secondTsb, withdrawal, canWithdraw
}) {
  const balanceCents = moneyInCents(totalBalance, 'Account balance');
  const componentCents = moneyInCents(taxFree, 'Tax-free component')
    + moneyInCents(taxedElement, 'Taxed element')
    + moneyInCents(untaxedElement, 'Untaxed element');
  if (componentCents !== balanceCents) {
    throw new RangeError('The three components must add up to the account balance.');
  }
  if (!Object.hasOwn(TAX_RATES, beneficiary)) throw new RangeError('Choose a valid beneficiary.');
  if (!Number.isInteger(age) || age < 0 || age > 120) {
    throw new RangeError('Age must be a whole number from 0 to 120.');
  }
  if (cycles !== 1 && cycles !== 2) throw new RangeError('Choose one or two cycles.');
  if (typeof canWithdraw !== 'boolean') throw new TypeError('Specify whether withdrawal access is available.');
  moneyInCents(withdrawal, 'Target withdrawal');

  const initial = { taxFree, taxedElement, untaxedElement };
  let current = initial;
  const steps = [];
  for (const [index, tsb] of (cycles === 2 ? [priorTsb, secondTsb] : [priorTsb]).entries()) {
    const memberAge = age + index * 3;
    const { cap, years } = bringForwardCap(tsb);
    const eligibleAge = memberAge >= 60 && memberAge <= 74;
    const amount = eligibleAge && canWithdraw ? Math.min(totalBalance, cap, withdrawal) : 0;

    // Restore the gross withdrawal as a tax-free contribution, keeping the balance constant.
    const remainingShare = totalBalance === 0 ? 1 : (totalBalance - amount) / totalBalance;
    const nextTaxed = current.taxedElement * remainingShare;
    const nextUntaxed = current.untaxedElement * remainingShare;
    const taxedWithdrawn = current.taxedElement - nextTaxed;
    const untaxedWithdrawn = current.untaxedElement - nextUntaxed;
    current = {
      taxFree: current.taxFree + taxedWithdrawn + untaxedWithdrawn,
      taxedElement: nextTaxed,
      untaxedElement: nextUntaxed
    };
    steps.push({
      year: 2026 + index * 3, memberAge, eligibleAge, cap, years, withdrawal: amount,
      taxedWithdrawn, untaxedWithdrawn, taxAfter: deathTax(current, beneficiary)
    });
  }

  const taxBefore = deathTax(initial, beneficiary);
  const taxAfter = deathTax(current, beneficiary);
  const estateSaving = components => beneficiary === 'tax_dependant'
    ? 0
    : (components.taxedElement + components.untaxedElement) * 0.02;
  return {
    taxBefore, taxAfter, taxSaved: taxBefore - taxAfter,
    estateSavingBefore: estateSaving(initial), estateSavingAfter: estateSaving(current),
    finalComponents: current, steps
  };
}
