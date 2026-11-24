// Values are in Canadian dollars. Ownership inputs are percentages.
export const FIRST_TIME = Object.freeze({ fullThrough: 835_000, endsAt: 860_000, maxSaving: 8_000 });
export const NEW_BUILD = Object.freeze({ fullThrough: 1_100_000, endsAt: 1_150_000 });
const FOREIGN_RATE = 0.20;

function priceInCents(price) {
  const cents = Math.round(price * 100);
  if (!Number.isFinite(price) || price < 0 || !Number.isSafeInteger(cents) || cents / 100 !== price) {
    throw new RangeError('Enter a valid fair market value in Canadian dollars with up to two decimal places.');
  }
  return cents;
}

function shareInBasisPoints(percent, label) {
  const points = Math.round(percent * 100);
  if (!Number.isFinite(percent) || percent < 1 || percent > 100 || points / 100 !== percent) {
    throw new RangeError(`Enter a ${label} share from 1% to 100% with up to two decimal places.`);
  }
  return points;
}

function standardTaxCents(priceCents) {
  const first = Math.min(priceCents, 20_000_000);
  const second = Math.max(0, Math.min(priceCents, 200_000_000) - 20_000_000);
  const third = Math.max(0, Math.min(priceCents, 300_000_000) - 200_000_000);
  const top = Math.max(0, priceCents - 300_000_000);
  return (first + 2 * second + 3 * third + 5 * top) / 100;
}

export function standardPropertyTransferTax(price) {
  return Math.round(standardTaxCents(priceInCents(price))) / 100;
}

export function calculatePtt({
  price,
  program = 'none',
  eligibleBuyerOwnershipPct = 100,
  foreignBuyerTax = false,
  foreignBuyerOwnershipPct = 100,
} = {}) {
  const valueCents = priceInCents(price);
  if (!valueCents) throw new RangeError('Enter a fair market value greater than zero.');
  if (!['none', 'first-time', 'new-build'].includes(program)) {
    throw new RangeError('Choose one exemption program or no exemption.');
  }
  if (typeof foreignBuyerTax !== 'boolean') {
    throw new RangeError('Choose whether the additional foreign buyer tax applies.');
  }
  const eligibleShare = program === 'none' ? 0 : shareInBasisPoints(eligibleBuyerOwnershipPct, 'qualifying ownership');
  const foreignShare = foreignBuyerTax ? shareInBasisPoints(foreignBuyerOwnershipPct, 'taxable foreign ownership') : 0;
  if (eligibleShare + foreignShare > 10_000) {
    throw new RangeError('Qualifying ownership and taxable foreign ownership must total 100% or less.');
  }

  // Round the displayed tax components to cents before reconciling the closing total.
  const rawStandardCents = standardTaxCents(valueCents);
  const standardCents = Math.round(rawStandardCents);
  let exemptionCents = 0;
  let stage = 'none';
  if (program !== 'none') {
    const rules = program === 'first-time' ? FIRST_TIME : NEW_BUILD;
    stage = price <= rules.fullThrough ? 'full' : price < rules.endsAt ? 'partial' : 'ended';
    const remainingCents = rules.endsAt * 100 - valueCents;
    const phaseOutWidthCents = (rules.endsAt - rules.fullThrough) * 100;
    const phaseOut = Math.max(0, Math.min(1, remainingCents / phaseOutWidthCents));
    const fullSavingCents = program === 'first-time'
      ? Math.min(rawStandardCents, FIRST_TIME.maxSaving * 100)
      : rawStandardCents;
    exemptionCents = Math.round(fullSavingCents * phaseOut * (eligibleShare / 10_000));
  }

  const foreignCents = Math.round(valueCents * FOREIGN_RATE * (foreignShare / 10_000));
  const totalCents = standardCents - exemptionCents + foreignCents;
  return {
    standardPtt: standardCents / 100,
    exemptionSaved: exemptionCents / 100,
    foreignTax: foreignCents / 100,
    totalDue: totalCents / 100,
    effectiveRate: (totalCents * 100) / valueCents,
    stage,
  };
}
