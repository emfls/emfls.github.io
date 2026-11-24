export const MAX_AMOUNT = 100_000_000;

function cents(value, name) {
  const rounded = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT || rounded / 100 !== value) {
    throw new RangeError(`${name} must be between $0 and $100,000,000 with up to two decimal places.`);
  }
  return rounded;
}

function monthCount(value, min, name) {
  if (!Number.isInteger(value) || value < min || value > 12) {
    throw new RangeError(`${name} must be a whole number from ${min} to 12.`);
  }
  return value;
}

/**
 * Estimate a single 2026 scenario. For TFSA, contributions before the optional
 * withdrawal, the withdrawal, and any redeposit occur in the first modeled month.
 * Balances are held constant in subsequent modeled months.
 */
export function calculatePenalty({
  account, room, contributions, months, age = '19+', openingUnused = 0,
  withdrawal = 0, redeposit = 0, nonResidentAmount = 0, nonResidentMonths = 0,
  nonResidentResolved = false, filedLate = false, lateMonths = 0,
}) {
  if (account !== 'rrsp' && account !== 'tfsa') throw new RangeError('Choose RRSP or TFSA.');
  const rrsp = account === 'rrsp';
  if (rrsp && age !== '18' && age !== '19+') throw new RangeError('Choose an RRSP age group.');

  const roomCents = cents(room, 'Starting room');
  const contributionCents = cents(contributions, 'Total contributions');
  const count = monthCount(months, rrsp ? 0 : 1, 'Scenario months');
  const lateCount = filedLate ? monthCount(lateMonths, 0, 'Late-filing months') : 0;
  const buffer = rrsp && age === '19+' ? 200_000 : 0;

  let excess;
  let taxableBase;
  let remainingRoom = 0;
  let redepositExcess = 0;
  let nextYearRestoration = 0;
  let nonResidentBase = 0;
  let nonResidentTax = 0;

  if (rrsp) {
    excess = Math.max(0, cents(openingUnused, 'Prior unused contributions') + contributionCents - roomCents);
    taxableBase = Math.max(0, excess - buffer);
  } else {
    const withdrawn = cents(withdrawal, 'TFSA withdrawal');
    const returned = cents(redeposit, 'TFSA redeposit');
    if (returned > withdrawn || returned > contributionCents) {
      throw new RangeError('The redeposit cannot exceed the withdrawal or total contributions.');
    }

    const beforeWithdrawal = contributionCents - returned;
    const initialExcess = Math.max(0, beforeWithdrawal - roomCents);
    const correctedExcess = Math.min(initialExcess, withdrawn);
    const roomBeforeRedeposit = Math.max(0, roomCents - beforeWithdrawal);

    redepositExcess = Math.max(0, returned - roomBeforeRedeposit);
    remainingRoom = Math.max(0, roomBeforeRedeposit - returned);
    nextYearRestoration = withdrawn - correctedExcess;
    excess = initialExcess - correctedExcess + redepositExcess;
    taxableBase = Math.max(initialExcess, excess);

    nonResidentBase = cents(nonResidentAmount, 'Non-resident contributions');
    if (nonResidentBase > contributionCents) {
      throw new RangeError('Non-resident contributions cannot exceed total contributions.');
    }
    nonResidentTax = nonResidentBase * monthCount(nonResidentMonths, 0, 'Non-resident taxable months');
  }

  // One per cent of a balance in cents gives tax in hundredths of a cent.
  // Accumulate the unrounded amounts so tiny monthly balances are not lost.
  const ongoingBase = rrsp ? (count === 0 ? 0 : taxableBase) : excess;
  const excessTax = count === 0 ? 0 : taxableBase + ongoingBase * (count - 1);
  const tax = excessTax + nonResidentTax;
  const latePenalty = filedLate ? tax * (5 + lateCount) : 0;
  const toDollars = (amount) => amount / 100;
  const taxToDollars = (amount) => toDollars(Math.round(amount / 100));

  return {
    excess: toDollars(excess),
    buffer: toDollars(buffer),
    protectedExcess: toDollars(Math.min(buffer, excess)),
    taxableBase: toDollars(taxableBase),
    monthlyTax: taxToDollars(count === 0 ? 0 : taxableBase),
    ongoingMonthlyTax: taxToDollars(ongoingBase),
    totalTax: taxToDollars(tax),
    latePenalty: toDollars(Math.round(latePenalty / 10_000)),
    withdrawNow: toDollars(Math.max(ongoingBase, nonResidentResolved ? 0 : nonResidentBase)),
    excessTax: taxToDollars(excessTax),
    nonResidentTax: taxToDollars(nonResidentTax),
    remainingRoom: toDollars(remainingRoom),
    redepositExcess: toDollars(redepositExcess),
    nextYearRestoration: toDollars(nextYearRestoration),
    dueDate: rrsp ? 'March 31, 2027' : 'June 30, 2027',
  };
}
