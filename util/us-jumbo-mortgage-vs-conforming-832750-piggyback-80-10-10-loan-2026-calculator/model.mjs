export const BASELINE = 832_750;
export const HIGH_COST = 1_249_125;
export const SPECIAL_CEILING = 1_873_675;
export const TAX_CAP = 750_000;

export const DEFAULTS = Object.freeze({
  homePrice: 1_100_000,
  downPercent: 10,
  countyLimit: BASELINE,
  firstYears: 30,
  jumboRate: 6.75,
  conformingRate: 6.25,
  secondRate: 8.25,
  secondYears: 15,
  jumboPmi: 0.45,
  conformingPmi: 0.50,
  reserveMonths: 9,
});

const horizons = [5, 10];

export function deductibleRatio(totalDebt) {
  return totalDebt === 0 ? null : Math.min(1, TAX_CAP / totalDebt);
}

// Keep payment and monthly balances unrounded until display.
export function amortize(principal, annualRate, months) {
  if (principal === 0) return [];
  const rate = annualRate / 1200;
  const payment = rate === 0
    ? principal / months
    : principal * rate / -Math.expm1(-months * Math.log1p(rate));
  let balance = principal;

  return Array.from({ length: months }, (_, index) => {
    const interest = balance * rate;
    const principalPaid = index === months - 1 ? balance : Math.min(balance, payment - interest);
    balance -= principalPaid;
    return { payment: principalPaid + interest, interest, balance };
  });
}

function validate(input) {
  const ranges = [
    ['homePrice', 'Home price', 1, 100_000_000],
    ['downPercent', 'Down payment percentage', 0, 100],
    ['countyLimit', 'County limit', BASELINE, SPECIAL_CEILING],
    ['jumboRate', 'Jumbo rate', 0, 30],
    ['conformingRate', 'Conforming rate', 0, 30],
    ['secondRate', 'Second-lien rate', 0, 30],
    ['jumboPmi', 'Jumbo PMI rate', 0, 10],
    ['conformingPmi', 'Conforming PMI rate', 0, 10],
  ];
  for (const [field, label, min, max] of ranges) {
    if (!Number.isFinite(input[field]) || input[field] < min || input[field] > max) {
      throw new RangeError(`${label} must be between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}.`);
    }
  }
  if (!Number.isInteger(input.countyLimit)) throw new RangeError('Enter the county limit in whole dollars.');
  if (![15, 20, 30].includes(input.firstYears)) throw new RangeError('Choose a 15-, 20-, or 30-year first loan.');
  if (![10, 15, 20].includes(input.secondYears)) throw new RangeError('Choose a 10-, 15-, or 20-year second lien.');
  if (!Number.isInteger(input.reserveMonths) || input.reserveMonths < 6 || input.reserveMonths > 12) {
    throw new RangeError('Choose 6 to 12 whole months of jumbo reserves.');
  }
}

function buildPlan({ id, kind, first, second, down, available }, input, homePrice, afterSecondMonth) {
  const firstRate = kind === 'jumbo' ? input.jumboRate : input.conformingRate;
  const firstMonths = input.firstYears * 12;
  const firstSchedule = amortize(first, firstRate, firstMonths);
  const secondSchedule = amortize(second, input.secondRate, input.secondYears * 12);
  const annualPmi = kind === 'jumbo' ? input.jumboPmi : input.conformingPmi;
  const originalPmi = first > homePrice * 0.8 + 1e-8 ? first * annualPmi / 1200 : 0;
  const monthCost = (index) => {
    const firstRow = firstSchedule[index];
    const secondRow = secondSchedule[index];
    const startingFirstBalance = index === 0 ? first : firstSchedule[index - 1]?.balance ?? 0;
    const pmi = firstRow && startingFirstBalance > homePrice * 0.78 + 1e-8 && index < firstMonths / 2
      ? originalPmi : 0;
    return {
      payment: (firstRow?.payment ?? 0) + (secondRow?.payment ?? 0) + pmi,
      interest: (firstRow?.interest ?? 0) + (secondRow?.interest ?? 0),
      pmi,
      balance: (firstRow?.balance ?? 0) + (secondRow?.balance ?? 0),
    };
  };

  const horizonResults = {};
  let payments = 0;
  let interest = 0;
  let pmi = 0;
  for (let index = 0; index < 120; index++) {
    const row = monthCost(index);
    payments += row.payment;
    interest += row.interest;
    pmi += row.pmi;
    if ((index + 1) % 60 === 0) {
      horizonResults[(index + 1) / 12] = {
        interest, pmi, financing: interest + pmi, balance: row.balance,
        cashPaid: down + payments, cashPlusCost: down + interest + pmi,
      };
    }
  }

  const openingMonth = monthCost(0);
  const debt = first + second;
  return {
    id, kind, first, second, down, available,
    monthOne: openingMonth.payment,
    monthOnePmi: openingMonth.pmi,
    afterSecond: afterSecondMonth === null ? null : monthCost(afterSecondMonth - 1).payment,
    blendedRate: debt === 0 ? null : (first * firstRate + second * input.secondRate) / debt,
    deductibleRatio: deductibleRatio(debt),
    reserve: kind === 'jumbo' ? openingMonth.payment * input.reserveMonths : null,
    horizons: horizonResults,
  };
}

export function compare(input) {
  validate(input);
  const priceCents = Math.round(input.homePrice * 100);
  const downCents = Math.round(priceCents * input.downPercent / 100);
  const debtCents = priceCents - downCents;
  const capCents = input.countyLimit * 100;
  const conformingCents = Math.min(debtCents, capCents);
  const firstCents = Math.min(conformingCents, Math.floor(priceCents * 4 / 5));
  const secondCents = debtCents - firstCents;
  const extraCents = debtCents - conformingCents;
  const debt = debtCents / 100;
  const down = downCents / 100;
  const extraCash = extraCents / 100;
  const afterSecondMonth = secondCents > 0 ? input.secondYears * 12 + 1 : null;
  const plans = [
    { id: 'single', kind: debt === 0 ? 'cash' : extraCents > 0 ? 'jumbo' : 'conforming', first: debt, second: 0, down, available: true },
    { id: 'piggyback', kind: 'piggyback', first: firstCents / 100, second: secondCents / 100, down, available: secondCents > 0 },
    { id: 'extra', kind: 'conforming', first: conformingCents / 100, second: 0, down: (downCents + extraCents) / 100, available: extraCents > 0 },
  ].map((plan) => buildPlan(plan, input, priceCents / 100, afterSecondMonth));

  const [single, , extra] = plans;
  const winners = {};
  const eligible = plans.filter((plan) => plan.available);
  for (const years of horizons) {
    extra.horizons[years].returnOnCash = extraCash === 0 ? null
      : 100 * (single.horizons[years].financing - extra.horizons[years].financing) / extraCash;
    winners[years] = {};
    for (const metric of ['cashPlusCost', 'cashPaid', 'financing']) {
      const minimum = Math.min(...eligible.map((plan) => Math.round(plan.horizons[years][metric] * 100)));
      winners[years][metric] = eligible
        .filter((plan) => Math.round(plan.horizons[years][metric] * 100) === minimum)
        .map((plan) => plan.id);
    }
  }

  return { debt, extraCash, afterSecondMonth, plans, winners };
}
