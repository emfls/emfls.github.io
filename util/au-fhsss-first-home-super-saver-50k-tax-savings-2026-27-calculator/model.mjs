export const RULES = Object.freeze({
  annualCap: 15000,
  lifetimeCap: 50000,
  concessionalCap: 32500,
  sgRate: 0.12,
  sgEarningsCap: 270830,
  entryTax: 0.15,
  releaseFraction: 0.85,
  releaseOffset: 0.30,
  defaultSic: 7.51
});

const BRACKETS = [[0, 0], [18200, 0.15], [45000, 0.30], [135000, 0.37], [190000, 0.45]];
const DAY = 86400000;
const cents = amount => Math.round(amount * 100) / 100;

export function marginalRate(income) {
  return BRACKETS.reduce((rate, [threshold, nextRate]) => income > threshold ? nextRate : rate, 0);
}

export function incomeTax(income, medicare = 0.02) {
  let total = income * medicare;
  for (const [index, [lower, rate]] of BRACKETS.entries()) {
    const upper = BRACKETS[index + 1]?.[0] ?? Infinity;
    total += Math.max(0, Math.min(income, upper) - lower) * rate;
  }
  return total;
}

export function releaseTaxRate(income, medicare = 0.02) {
  return Math.max(0, Math.round((marginalRate(income) + medicare - RULES.releaseOffset) * 10000) / 10000);
}

function dailyGrowth(start, end, annualRate) {
  let growth = 1;
  for (let day = start; day < end;) {
    const year = new Date(day).getUTCFullYear();
    const nextYear = Date.UTC(year + 1, 0, 1);
    const yearDays = (nextYear - Date.UTC(year, 0, 1)) / DAY;
    const stop = Math.min(end, nextYear);
    growth *= (1 + annualRate / yearDays) ** ((stop - day) / DAY);
    day = stop;
  }
  return growth;
}

function requireRange(value, max, label) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(`Enter ${label} between 0 and ${max.toLocaleString('en-AU')}.`);
  }
}

function requireMoney(value, max, label) {
  requireRange(value, max, label);
  if (cents(value) !== value) throw new RangeError(`Enter ${label} in whole cents.`);
}

function bankAfterTax(opening, deposits, monthGrowth, income, medicare) {
  let balance = opening;
  for (const [month, deposit] of deposits.entries()) {
    balance = (balance + deposit) * monthGrowth[month];
  }
  const principal = opening + deposits.reduce((sum, amount) => sum + amount, 0);
  const interest = balance - principal;
  return balance - (incomeTax(income + interest, medicare) - incomeTax(income, medicare));
}

function projectBuyer(buyer, years, sicRate, bankRate) {
  const { salary, concessional, nonConcessional, otherConcessional = 0, medicare = 0.02 } = buyer;
  requireMoney(salary, 10000000, 'annual salary');
  requireMoney(concessional, salary, 'the pre-tax budget (up to annual salary)');
  requireMoney(otherConcessional, 1000000, 'other concessional contributions');
  requireRange(medicare, 0.02, 'the Medicare levy rate');

  const baselineIncome = salary - concessional;
  const baselineTax = incomeTax(baselineIncome, medicare);
  requireMoney(nonConcessional, cents(baselineIncome - baselineTax), 'the after-tax budget (up to remaining take-home pay)');

  const employerSG = cents(Math.min(salary, RULES.sgEarningsCap) * RULES.sgRate);
  const capRoom = Math.max(0, cents(RULES.concessionalCap - employerSG - otherConcessional));
  const concessionalCapExceeded = cents(employerSG + otherConcessional + concessional) > RULES.concessionalCap;
  const baselineFraction = concessional > 0 ? 1 - (incomeTax(salary, medicare) - baselineTax) / concessional : 0;
  const determination = Date.UTC(2026 + years, 5, 30);
  const annual = [];
  let eligible = 0;
  let concessionalPrincipal = 0;
  let nonConcessionalPrincipal = 0;
  let associatedEarnings = 0;
  let bankSavings = 0;
  let overflowBank = 0;

  for (let year = 0; year < years; year++) {
    let yearConcessional = 0;
    let yearNonConcessional = 0;
    const deposits = [];
    const baselineDeposits = [];
    const bankGrowth = [];

    for (let month = 0; month < 12; month++) {
      const beforeTax = cents(cents(concessional * (month + 1) / 12) - cents(concessional * month / 12));
      const afterTax = cents(cents(nonConcessional * (month + 1) / 12) - cents(nonConcessional * month / 12));
      const start = Date.UTC(2026 + year, 6 + month, 1);
      const next = Date.UTC(2026 + year, 7 + month, 1);
      const room = Math.max(0, Math.min(RULES.annualCap - yearConcessional - yearNonConcessional, RULES.lifetimeCap - eligible));
      const acceptedAfterTax = cents(Math.min(afterTax, room));
      const acceptedBeforeTax = cents(Math.min(beforeTax, Math.max(0, capRoom - yearConcessional), Math.max(0, room - acceptedAfterTax)));
      yearNonConcessional += acceptedAfterTax;
      yearConcessional += acceptedBeforeTax;
      eligible += acceptedAfterTax + acceptedBeforeTax;

      associatedEarnings += (acceptedAfterTax + acceptedBeforeTax * RULES.releaseFraction) *
        (dailyGrowth(start, determination + DAY, sicRate) - 1);
      bankGrowth.push(dailyGrowth(start, next, bankRate));
      deposits.push({ beforeTax: cents(beforeTax - acceptedBeforeTax), afterTax: cents(afterTax - acceptedAfterTax) });
      baselineDeposits.push(beforeTax * baselineFraction + afterTax);
    }

    const strategyIncome = salary - yearConcessional;
    const unusedGross = cents(concessional - yearConcessional);
    // Value the diverted gross dollars at the incremental tax they actually incur.
    const keptFraction = unusedGross > 0
      ? 1 - (incomeTax(strategyIncome, medicare) - baselineTax) / unusedGross
      : 0;
    overflowBank = bankAfterTax(overflowBank, deposits.map(({ beforeTax, afterTax }) => beforeTax * keptFraction + afterTax),
      bankGrowth, strategyIncome, medicare);
    bankSavings = bankAfterTax(bankSavings, baselineDeposits, bankGrowth, salary, medicare);
    concessionalPrincipal += yearConcessional * RULES.releaseFraction;
    nonConcessionalPrincipal += yearNonConcessional;
    annual.push({ concessional: cents(yearConcessional), nonConcessional: cents(yearNonConcessional) });
  }

  const releaseIncome = salary - annual.at(-1).concessional;
  const rate = releaseTaxRate(releaseIncome, medicare);
  const assessable = concessionalPrincipal + associatedEarnings;
  const withdrawalTax = assessable * rate;
  const grossRelease = assessable + nonConcessionalPrincipal;
  const netRelease = grossRelease - withdrawalTax;
  return {
    annual, employerSG, capRoom, concessionalCapExceeded, eligible: cents(eligible),
    concessionalPrincipal, nonConcessionalPrincipal, associatedEarnings, assessable,
    rate, releaseIncome, withdrawalTax, grossRelease, netRelease, bankSavings, overflowBank,
    strategyDeposit: netRelease + overflowBank
  };
}

export function calculateFHSS({ buyers, years = 4, sic = RULES.defaultSic, bank = 4.5 }) {
  if (!Array.isArray(buyers) || buyers.length < 1 || buyers.length > 2) {
    throw new RangeError('Enter one or two buyers.');
  }
  if (!Number.isInteger(years) || years < 1 || years > 5) {
    throw new RangeError('Choose a savings period of 1 to 5 years.');
  }
  requireRange(sic, 100, 'the annual SIC percentage');
  requireRange(bank, 100, 'the annual bank interest percentage');

  const people = buyers.map(buyer => projectBuyer(buyer, years, sic / 100, bank / 100));
  const sum = key => people.reduce((total, person) => total + person[key], 0);
  const strategyDeposit = sum('strategyDeposit');
  const bankSavings = sum('bankSavings');
  return {
    people, strategyDeposit, bankSavings, boost: strategyDeposit - bankSavings,
    netRelease: sum('netRelease'), grossRelease: sum('grossRelease'), withdrawalTax: sum('withdrawalTax'),
    eligible: sum('eligible'), overflowBank: sum('overflowBank'), associatedEarnings: sum('associatedEarnings'),
    assessable: sum('assessable'), concessionalPrincipal: sum('concessionalPrincipal'),
    nonConcessionalPrincipal: sum('nonConcessionalPrincipal')
  };
}
