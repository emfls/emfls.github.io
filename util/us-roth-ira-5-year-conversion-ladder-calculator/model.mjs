const MAX_CENTS = 10_000_000_000;
const roundRatio = (n, d) => Math.floor((n + d / 2) / d);

export function checkInteger(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(name + ' is outside the supported range.');
  }
  return value;
}

export function parseCents(value) {
  const match = /^([+-]?)([0-9]{1,9})(?:[.]([0-9]{1,2}))?$/.exec(String(value).trim());
  if (!match) throw new RangeError('Enter a number with up to two decimal places.');
  const cents = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return checkInteger(match[1] === '-' && cents ? -cents : cents, -MAX_CENTS, MAX_CENTS, 'Amount');
}

const RATES = [10, 12, 22, 24, 32, 35, 37];
const TAX = {
  single: {deduction: 16100, ceilings: [12400, 50400, 105700, 201775, 256225, 640600]},
  mfj: {deduction: 32200, ceilings: [24800, 100800, 211400, 403550, 512450, 768700]},
  hoh: {deduction: 24150, ceilings: [17700, 67450, 105700, 201750, 256200, 640600]},
};

export function ordinaryTax2026(status, gross) {
  if (!Object.hasOwn(TAX, status)) throw new RangeError('Choose a filing status.');
  checkInteger(gross, 0, MAX_CENTS * 50, 'Gross ordinary income');
  const {deduction, ceilings} = TAX[status];
  const taxable = Math.max(0, gross - deduction * 100);
  let lower = 0;
  let tax = 0;
  for (const [index, rate] of RATES.entries()) {
    const upper = (ceilings[index] ?? Infinity) * 100;
    tax += Math.max(0, Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return roundRatio(tax, 100);
}

export function conversionTax2026({status, otherIncome, taxableConversion}) {
  checkInteger(otherIncome, 0, MAX_CENTS, 'Other ordinary income');
  checkInteger(taxableConversion, 0, MAX_CENTS * 40, 'Taxable conversion');
  const income = otherIncome + taxableConversion;
  const tax = ordinaryTax2026(status, income) - ordinaryTax2026(status, otherIncome);
  const {deduction, ceilings} = TAX[status];
  const room = ceiling => Math.max(0, ceiling * 100 - income);
  const headroom0 = room(deduction);
  const headroomTo10 = room(deduction + ceilings[0]);
  const headroomTo12 = room(deduction + ceilings[1]);
  return {
    tax, deduction: deduction * 100,
    effectiveBps: taxableConversion ? roundRatio(tax * 10000, taxableConversion) : null,
    headroom0, headroom10: headroomTo10 - headroom0, headroom12: headroomTo12 - headroomTo10,
    headroomTo10, headroomTo12,
  };
}

export function unlockYear(year) {
  return checkInteger(year, 1900, 9994, 'Conversion year') + 5;
}

export function planLadder({
  status, otherIncome, annualSpending, cash, brokerage, contributions, inflationBps, ageMonths,
}) {
  for (const [label, value] of Object.entries({annualSpending, cash, brokerage, contributions})) {
    checkInteger(value, 0, MAX_CENTS, label);
  }
  checkInteger(ageMonths, 0, 1200, 'Age in months');
  checkInteger(inflationBps, 0, 2000, 'Inflation');
  const spending = [annualSpending];
  for (let i = 1; i < 15; i++) {
    spending.push(roundRatio(spending[i - 1] * (10000 + inflationBps), 10000));
  }
  let remaining = cash + brokerage + contributions;
  const bridge = spending.slice(0, 5).map((expense, index) => {
    remaining -= expense;
    return {year: 2026 + index, spending: expense, remaining};
  });
  const ladder = spending.slice(5).map((conversion, index) => {
    const year = 2026 + index;
    const available = unlockYear(year);
    const directPenaltyAvoided = ageMonths + (available - 2026) * 12 < 714
      ? roundRatio(conversion, 10) : 0;
    return {year, unlockYear: available, conversion, directPenaltyAvoided};
  });
  const firstTax = conversionTax2026({status, otherIncome, taxableConversion: ladder[0].conversion});
  return {bridge, ladder, bridgeNet: remaining, firstTax};
}

export function rothWithdrawal({
  year, ageMonths, withdrawal, contributions, conversions, earnings, firstRothYear,
}) {
  checkInteger(year, 1900, 9999, 'Withdrawal year');
  checkInteger(firstRothYear, 1900, year, 'First Roth funding year');
  checkInteger(ageMonths, 0, 1500, 'Age in months');
  for (const [label, value] of Object.entries({withdrawal, contributions, earnings})) {
    checkInteger(value, 0, MAX_CENTS, label);
  }
  let remaining = withdrawal;
  const take = available => {
    const used = Math.min(remaining, available);
    remaining -= used;
    return used;
  };
  const regularUsed = take(contributions);
  let taxableConvertedUsed = 0;
  let nontaxableConvertedUsed = 0;
  let recaptureBase = 0;
  const cohorts = new Map();
  for (const lot of conversions) {
    checkInteger(lot.year, firstRothYear, year, 'Conversion year');
    checkInteger(lot.taxable, 0, MAX_CENTS, 'Taxable conversion basis');
    checkInteger(lot.nontaxable, 0, MAX_CENTS, 'Nontaxable conversion basis');
    const cohort = cohorts.get(lot.year) ?? {taxable: 0, nontaxable: 0};
    cohort.taxable += lot.taxable;
    cohort.nontaxable += lot.nontaxable;
    cohorts.set(lot.year, cohort);
  }
  for (const cohortYear of [...cohorts.keys()].sort((a, b) => a - b)) {
    const {taxable, nontaxable} = cohorts.get(cohortYear);
    const taxableUsed = take(taxable);
    taxableConvertedUsed += taxableUsed;
    nontaxableConvertedUsed += take(nontaxable);
    if (ageMonths < 714 && year - cohortYear < 5) recaptureBase += taxableUsed;
  }
  const earningsUsed = take(earnings);
  const qualified = ageMonths >= 714 && year - firstRothYear >= 5;
  return {
    regularUsed, taxableConvertedUsed, nontaxableConvertedUsed, recaptureBase, earningsUsed,
    taxableEarnings: qualified ? 0 : earningsUsed,
    recapturePenalty: roundRatio(recaptureBase, 10),
    earningsPenalty: ageMonths < 714 ? roundRatio(earningsUsed, 10) : 0,
    unfunded: remaining,
  };
}
