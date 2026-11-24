const MAX_INPUT = 1_000_000_000;
const FEDERAL_RATES = [1000, 1200, 2200, 2400, 3200, 3500, 3700];
const CA_RATES = [100, 200, 400, 600, 800, 930, 1030, 1130, 1230];

function filingRules(deduction, medicareThreshold, brackets, caDeduction, caBrackets) {
  return Object.freeze({
    deduction, medicareThreshold, brackets: Object.freeze(brackets),
    caDeduction, caBrackets: Object.freeze(caBrackets)
  });
}

const caSingleBrackets = [11456, 27157, 42861, 59498, 75197, 384109, 460927, 768213];

export const FILING = Object.freeze({
  single: filingRules(16100, 200000, [12400, 50400, 105700, 201775, 256225, 640600], 5900, caSingleBrackets),
  mfj: filingRules(32200, 250000, [24800, 100800, 211400, 403550, 512450, 768700], 11800,
    [22912, 54314, 85722, 118996, 150394, 768218, 921854, 1536426]),
  mfs: filingRules(16100, 125000, [12400, 50400, 105700, 201775, 256225, 384350], 5900, caSingleBrackets),
  hoh: filingRules(24150, 200000, [17700, 67450, 105700, 201750, 256200, 640600], 11800,
    [22927, 54316, 70018, 86654, 102356, 522385, 626864, 1044771])
});

export const STATE_PRESETS = Object.freeze({
  CA: Object.freeze({ withholding: 10.23, tax: null }),
  NY: Object.freeze({ withholding: 11.70, tax: 6.85 }),
  MA: Object.freeze({ withholding: 5, tax: 5 }),
  WA: Object.freeze({ withholding: 0, tax: 0 }),
  TX: Object.freeze({ withholding: 0, tax: 0 }),
  FL: Object.freeze({ withholding: 0, tax: 0 }),
  custom: Object.freeze({ withholding: 0, tax: 0 })
});

function cents(value, label, max = MAX_INPUT, min = 0) {
  const scaled = Math.round(value * 100);
  if (!Number.isFinite(value) || value < min || value > max || Math.abs(value - scaled / 100) > 1e-9) {
    throw new RangeError(`Enter ${label} from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')} with up to two decimal places.`);
  }
  return scaled;
}

function getFiling(filing) {
  if (!Object.hasOwn(FILING, filing)) throw new RangeError('Select a supported filing status.');
  return FILING[filing];
}

function sliceAbove(base, added, threshold) {
  return Math.max(0, base + added - threshold) - Math.max(0, base - threshold);
}

function atRate(amount, basisPoints) {
  return Math.round(amount * basisPoints / 10000);
}

// Accumulate the entire bracket schedule before rounding to a cent.
function progressiveTax(taxable, cutoffs, rates) {
  let taxUnits = 0;
  let lower = 0;
  for (const [index, rate] of rates.entries()) {
    if (lower >= taxable) break;
    const upper = Math.min(taxable, (cutoffs[index] ?? Infinity) * 100);
    taxUnits += (upper - lower) * rate;
    lower = upper;
  }
  return Math.round(taxUnits / 10000);
}

export function federalIncomeTax(taxableIncome, filing = 'single') {
  return progressiveTax(cents(taxableIncome, 'taxable income'), getFiling(filing).brackets, FEDERAL_RATES) / 100;
}

export function safeHarbor({ currentTax, withholding, priorAgi, priorTax, priorEligible = true, filing = 'single' }) {
  getFiling(filing);
  const current = cents(currentTax, 'expected current federal tax', 3 * MAX_INPUT);
  const prepaid = cents(withholding, 'expected federal withholding', 3 * MAX_INPUT);
  const agi = priorAgi == null ? null : cents(priorAgi, 'prior-year AGI', MAX_INPUT, -MAX_INPUT);
  const tax = priorTax == null ? null : cents(priorTax, 'prior-year federal tax');
  const priorRate = !priorEligible || agi === null || tax === null
    ? null : agi > (filing === 'mfs' ? 7_500_000 : 15_000_000) ? 110 : 100;
  const priorTarget = priorRate === null ? null : Math.ceil(tax * priorRate / 100);
  const currentTarget = Math.ceil(current * 90 / 100);
  const target = Math.min(currentTarget, priorTarget ?? Infinity);
  const balance = Math.max(0, current - prepaid);
  const annual = balance < 100_000 ? 0 : Math.max(0, target - prepaid);
  return {
    currentTax, withholding, balance: balance / 100, currentTarget: currentTarget / 100,
    priorRate, priorTarget: priorTarget === null ? null : priorTarget / 100,
    target: target / 100, annual: annual / 100, quarterly: Math.ceil(annual / 4) / 100
  };
}

export function calculateVesting({
  filing = 'single', shares, sharePrice, baseSalary, spouseIncome = 0, deduction,
  ytdSocialWages = 0, ytdMedicareWages, ytdSupplemental = 0, annualMedicareWages,
  state = 'WA', stateWithholdingRate, stateTaxRate, caDeduction, includeCaSdi = true,
  otherWithholding, priorAgi, priorTax, priorEligible = true, federalTaxOverride
}) {
  const rules = getFiling(filing);
  if (!Object.hasOwn(STATE_PRESETS, state)) throw new RangeError('Select a supported state preset.');
  if (!Number.isInteger(shares) || shares < 0 || shares > MAX_INPUT) {
    throw new RangeError('Enter a valid whole number of vesting shares.');
  }
  const price = cents(sharePrice, 'vest price');
  if (!price) throw new RangeError('Enter a vest price of at least $0.01.');
  const vest = shares * price;
  if (vest > MAX_INPUT * 100) throw new RangeError('Enter a vest value of $1 billion or less.');

  const ownPay = cents(baseSalary, 'annual wages');
  const householdPay = ownPay + (filing === 'mfj' ? cents(spouseIncome, 'spouse wages') : 0);
  const deductionCents = cents(deduction ?? rules.deduction, 'federal deduction');
  const federalBefore = progressiveTax(Math.max(0, householdPay - deductionCents), rules.brackets, FEDERAL_RATES);
  const federalAfter = progressiveTax(Math.max(0, householdPay + vest - deductionCents), rules.brackets, FEDERAL_RATES);

  const socialWages = cents(ytdSocialWages, 'prior Social Security wages');
  const medicareWages = cents(ytdMedicareWages ?? ytdSocialWages, 'prior Medicare wages');
  const supplemental = cents(ytdSupplemental, 'prior supplemental wages');
  const householdMedicare = annualMedicareWages == null
    ? householdPay : cents(annualMedicareWages, 'annual household Medicare wages');
  const medicareThreshold = rules.medicareThreshold * 100;
  const federalHighSlice = sliceAbove(supplemental, vest, 100_000_000);

  const preset = STATE_PRESETS[state];
  const statePayroll = state === 'CA' && includeCaSdi ? atRate(vest, 130) : 0;
  const withheld = {
    federal: Math.round(((vest - federalHighSlice) * 2200 + federalHighSlice * 3700) / 10000),
    social: atRate(Math.min(vest, Math.max(0, 18_450_000 - socialWages)), 620),
    medicare: atRate(vest, 145),
    additionalMedicare: atRate(sliceAbove(medicareWages, vest, 20_000_000), 90),
    state: atRate(vest, cents(stateWithholdingRate ?? preset.withholding, 'state withholding rate', 100)),
    statePayroll
  };

  let stateTax;
  if (state === 'CA' && stateTaxRate == null) {
    const stateDeduction = cents(caDeduction ?? rules.caDeduction, 'California deduction');
    const before = Math.max(0, householdPay - stateDeduction);
    const after = Math.max(0, householdPay + vest - stateDeduction);
    stateTax = progressiveTax(after, rules.caBrackets, CA_RATES) - progressiveTax(before, rules.caBrackets, CA_RATES)
      + atRate(sliceAbove(before, after - before, 100_000_000), 100);
  } else {
    stateTax = atRate(vest, cents(stateTaxRate ?? preset.tax, 'state tax rate', 100));
  }

  const actual = {
    ...withheld,
    federal: federalAfter - federalBefore,
    additionalMedicare: atRate(sliceAbove(householdMedicare, vest, medicareThreshold), 90),
    state: stateTax
  };

  const totalWithheld = Object.values(withheld).reduce((sum, amount) => sum + amount, 0);
  const totalActual = Object.values(actual).reduce((sum, amount) => sum + amount, 0);
  const totalGap = totalActual - totalWithheld;
  const coverShares = Math.ceil(totalWithheld / price);
  const sharesSold = Math.min(shares, coverShares);
  const netShares = shares - sharesSold;
  const extraShares = Math.ceil(Math.max(0, totalGap) / price);
  const extraSharesAvailable = Math.min(netShares, extraShares);
  const estimatedFederalTax = federalAfter + atRate(Math.max(0, householdMedicare + vest - medicareThreshold), 90);
  const estimate = otherWithholding == null ? null : safeHarbor({
    filing, priorAgi, priorTax, priorEligible,
    currentTax: federalTaxOverride ?? estimatedFederalTax / 100,
    withholding: (cents(otherWithholding, 'other federal withholding') + withheld.federal + withheld.additionalMedicare) / 100
  });

  const toDollars = amounts => Object.fromEntries(Object.entries(amounts).map(([key, value]) => [key, value / 100]));
  return {
    vestingValue: vest / 100, withheld: toDollars(withheld), actual: toDollars(actual),
    totalWithheld: totalWithheld / 100, totalActual: totalActual / 100,
    federalGap: (actual.federal - withheld.federal) / 100, totalGap: totalGap / 100,
    coverShares, sharesSold, netShares, extraShares, extraSharesAvailable,
    coverCashNeeded: Math.max(0, totalWithheld - sharesSold * price) / 100,
    unfundedGap: Math.max(0, totalGap - extraSharesAvailable * price) / 100,
    estimate
  };
}
