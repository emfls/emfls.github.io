// 2026 FTB Form 540 schedules and NY IT-2105-I. Rows list the lower
// threshold, marginal rate and published base tax at that threshold.
const CA = {
  single: [
    [0, .01, 0], [11456, .02, 114.56], [27157, .04, 428.58],
    [42861, .06, 1056.74], [59498, .08, 2054.96], [75197, .093, 3310.88],
    [384109, .103, 32039.70], [460927, .113, 39951.95], [768213, .123, 74675.27]
  ],
  mfj: [
    [0, .01, 0], [22912, .02, 229.12], [54314, .04, 857.16],
    [85722, .06, 2113.48], [118996, .08, 4109.92], [150394, .093, 6621.76],
    [768218, .103, 64079.39], [921854, .113, 79903.90], [1536426, .123, 149350.54]
  ]
};
const NY = {
  single: [
    [0, .039, 0], [8500, .044, 332], [11700, .0515, 473],
    [13900, .054, 586], [80650, .059, 4191], [215400, .0685, 12141],
    [1077550, .0965, 71198], [5000000, .103, 449714]
  ],
  mfj: [
    [0, .039, 0], [17150, .044, 669], [23600, .0515, 953],
    [27900, .054, 1174], [161550, .059, 8391], [323200, .0685, 17928],
    [2155350, .0965, 143430], [5000000, .103, 417939]
  ]
};
const NYC = {
  single: [[0, .03078, 0], [12000, .03762, 369], [25000, .03819, 858], [50000, .03876, 1813]],
  mfj: [[0, .03078, 0], [21600, .03762, 665], [45000, .03819, 1545], [90000, .03876, 3264]]
};
// NY worksheets 2–5 and 8–10: taxable threshold, recapture base, incremental benefit.
const NY_RECAPTURE = {
  single: [[215400, 567, 2047], [1077550, 2614, 30172], [5000000, 32786, 32500]],
  mfj: [[161550, 333, 807], [323200, 1140, 3071], [2155350, 4211, 60350], [5000000, 64561, 32500]]
};
// NJ-1040-ES tables A and B: lower threshold, rate, amount to subtract.
const NJ = {
  single: [
    [0, .014, 0], [20000, .0175, 70], [35000, .035, 682.50],
    [40000, .05525, 1492.50], [75000, .0637, 2126.25],
    [500000, .0897, 15126.25], [1000000, .1075, 32926.25]
  ],
  mfj: [
    [0, .014, 0], [20000, .0175, 70], [50000, .0245, 420],
    [70000, .035, 1154.50], [80000, .05525, 2775], [150000, .0637, 4042.50],
    [500000, .0897, 17042.50], [1000000, .1075, 34842.50]
  ]
};

const positive = value => Math.max(0, value);
const activeBracket = (taxable, schedule) =>
  schedule.findLast(([threshold]) => taxable > threshold) ?? schedule[0];

function scheduledTax(taxable, schedule) {
  const [threshold, rate, base] = activeBracket(taxable, schedule);
  return base + (taxable - threshold) * rate;
}

function taxBill({ income = 0, local = 0, surtax = 0, payroll = 0 } = {}) {
  return { income, local, surtax, payroll, total: income + local + surtax + payroll };
}

export function californiaTax(wages, gains, filing) {
  const taxable = positive(wages + gains - (filing === 'mfj' ? 11800 : 5900));
  return taxBill({
    income: scheduledTax(taxable, CA[filing]),
    surtax: positive(taxable - 1000000) * .01,
    payroll: wages * .013
  });
}

function recaptureFraction(agi, threshold) {
  // IT-2105-I rounds the phase-in fraction to four decimals.
  return Math.round(Math.min(1, (agi - threshold) / 50000) * 10000) / 10000;
}

function newYorkStateTax(agi, taxable, filing) {
  if (agi > 25000000) return taxable * .109;
  const baseTax = scheduledTax(taxable, NY[filing]);
  if (agi <= 107650) return baseTax;
  const tier = NY_RECAPTURE[filing].findLast(([threshold]) => taxable > threshold);
  if (!tier) {
    const fullTax = taxable * (filing === 'mfj' ? .054 : .059);
    return baseTax + (fullTax - baseTax) * recaptureFraction(agi, 107650);
  }
  const [threshold, base, increment] = tier;
  return baseTax + base + increment * recaptureFraction(agi, threshold);
}

export function newYorkCityTax(agi, filing) {
  const taxable = positive(agi - (filing === 'mfj' ? 16050 : 8000));
  return taxBill({
    income: newYorkStateTax(agi, taxable, filing),
    local: scheduledTax(taxable, NYC[filing])
  });
}

export function newJerseyTax(gross, filing) {
  const joint = filing === 'mfj';
  if (gross <= (joint ? 20000 : 10000)) return taxBill();
  const taxable = gross - (joint ? 2000 : 1000);
  const [, rate, subtraction] = activeBracket(taxable, NJ[filing]);
  return taxBill({ income: taxable * rate - subtraction });
}

export function massachusettsTax(gross, filing) {
  const taxable = positive(gross - (filing === 'mfj' ? 8800 : 4400));
  return taxBill({ income: taxable * .05, surtax: positive(taxable - 1107750) * .04 });
}

export function washingtonTax(gains) {
  const taxable = positive(gains - 290000);
  return taxBill({ income: taxable * .07, surtax: positive(taxable - 1000000) * .029 });
}

export function futureValue(annual, rate, years) {
  // Grow the prior balance before adding the current year-end contribution.
  let balance = 0;
  for (let year = 0; year < years; year++) {
    balance = balance * (1 + rate) + annual;
  }
  return balance;
}

export const HORIZON = 10;
export const LOCATIONS = Object.freeze({
  ca: 'California', nyc: 'New York City', nj: 'New Jersey',
  ma: 'Massachusetts', wa: 'Washington', tx: 'Texas', fl: 'Florida',
  nv: 'Nevada', zero: 'Texas, Florida, Nevada & Wyoming'
});

export function calculateRelocation({
  salary, bonus, rsu, gains, filing, homeValue, caPropertyPct, txPropertyPct, returnPct
}) {
  if (filing !== 'single' && filing !== 'mfj') throw new RangeError('Choose a filing status.');
  if (![salary, bonus, rsu, gains, homeValue].every(value => Number.isFinite(value) && value >= 0 && value <= 1e9)) {
    throw new RangeError('Enter dollar amounts from $0 to $1 billion.');
  }
  if (![caPropertyPct, txPropertyPct].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) {
    throw new RangeError('Enter property tax rates from 0% to 100%.');
  }
  if (!Number.isFinite(returnPct) || returnPct < -99 || returnPct > 100) {
    throw new RangeError('Enter a return from −99% to 100%.');
  }

  const wages = salary + bonus + rsu;
  const gross = wages + gains;
  const bills = {
    ca: californiaTax(wages, gains, filing),
    nyc: newYorkCityTax(gross, filing),
    nj: newJerseyTax(gross, filing),
    ma: massachusettsTax(gross, filing),
    wa: washingtonTax(gains),
    zero: taxBill()
  };
  const ranking = Object.entries(bills)
    .map(([id, bill]) => ({ id, ...bill }))
    .sort((a, b) => a.total - b.total);
  const caProperty = homeValue * caPropertyPct / 100;
  const txProperty = homeValue * txPropertyPct / 100;
  const routes = ['ca', 'nyc'].flatMap(origin => ['tx', 'fl', 'nv', 'wa'].map(destination => {
    const destinationBill = destination === 'wa' ? bills.wa : bills.zero;
    const taxSavings = bills[origin].total - destinationBill.total;
    const propertyDelta = origin === 'ca' && destination === 'tx' && homeValue > 0
      ? txProperty - caProperty : null;
    const annualSavings = taxSavings - (propertyDelta ?? 0);
    return {
      origin, destination, taxSavings, propertyDelta, annualSavings,
      wealth: futureValue(annualSavings, returnPct / 100, HORIZON)
    };
  }));
  return { wages, gross, ranking, routes, caProperty, txProperty };
}
