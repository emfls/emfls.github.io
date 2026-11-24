const ISA_LIMIT = 20_000;
const LISA_LIMIT = 4_000;
const LISA_BONUS = 0.25;
const HOME_CAP = 450_000;
const ANNUAL_ALLOWANCE = 60_000;
const MPAA = 10_000;
const LUMP_SUM_ALLOWANCE = 268_275;
const EMPLOYER_NI = 0.15;

export const defaults = Object.freeze({
  budget: 4000, age: 35, years: 25, annualReturn: 0.05,
  relief: 0.2, retirementTax: 0.2, hasLisa: false,
  lisaExit: 'later', price: 450_000, salarySacrifice: false,
  employeeNI: 0.08, shareEmployerNI: false, sacrificeLimit: 20_000,
  relevantEarnings: 45_000, pensionHeadroom: ANNUAL_ALLOWANCE, mpaa: false,
  thresholdIncome: 0, adjustedIncome: 0, remainingLSA: LUMP_SUM_ALLOWANCE
});

function checkRange(value, min, max, name) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter ${name} from ${min} to ${max}.`);
  }
}

function lisaCharge(exit, price, date) {
  if (exit === 'later') return 0;
  if (exit === 'early') return 0.25;
  if (exit !== 'home') throw new RangeError('Choose a Lifetime ISA withdrawal scenario.');
  if (price <= HOME_CAP) return 0;
  return date < '2026-10-29' ? 0.25 : 0.20;
}

export function lisaWithdrawal(deposit, exit, price = HOME_CAP, date = '2026-10-29') {
  checkRange(deposit, 0, LISA_LIMIT, 'a Lifetime ISA deposit');
  if (exit === 'home') checkRange(price, 1, 100_000_000, 'a home price');
  const bonus = deposit * LISA_BONUS;
  const pot = deposit + bonus;
  const rate = lisaCharge(exit, price, date);
  const charge = pot * rate;
  const net = pot - charge;
  const gain = net - deposit;
  return { bonus, pot, rate, charge, net, gain, gainRate: deposit ? gain / deposit : 0 };
}

export function annualAllowance(thresholdIncome, adjustedIncome) {
  if (thresholdIncome <= 200_000 || adjustedIncome <= 260_000) return ANNUAL_ALLOWANCE;
  return Math.max(10_000, ANNUAL_ALLOWANCE - (adjustedIncome - 260_000) / 2);
}

export function pensionDeposit(budget, relief, employeeNI = 0, employerNI = 0,
  cap = ANNUAL_ALLOWANCE, niExemption = Infinity, sacrificeLimit = Infinity) {
  const afterTax = 1 - relief;
  const afterTaxAndNI = afterTax - employeeNI;
  // Split salary sacrificed into the NI-exempt portion and the portion above it.
  const exempt = Math.min(
    niExemption, sacrificeLimit, budget / afterTaxAndNI, cap / (1 + employerNI)
  );
  const exemptCost = exempt * afterTaxAndNI;
  const exemptGross = exempt * (1 + employerNI);
  const excess = Math.max(0, Math.min(
    (budget - exemptCost) / afterTax, cap - exemptGross, sacrificeLimit - exempt
  ));
  return { gross: exemptGross + excess, netUsed: Math.min(budget, exemptCost + excess * afterTax) };
}

export function pensionWithdrawal(pot, taxRate, remainingLSA = LUMP_SUM_ALLOWANCE) {
  const taxFree = Math.min(pot * 0.25, remainingLSA);
  const taxable = pot - taxFree;
  const tax = taxable * taxRate;
  return { taxFree, taxable, tax, net: pot - tax };
}

export function compare(options = {}) {
  const settings = { ...defaults, ...options };
  const { budget, age, years, annualReturn, relief, retirementTax, hasLisa, lisaExit, price,
    salarySacrifice, employeeNI, shareEmployerNI, sacrificeLimit, relevantEarnings, pensionHeadroom,
    mpaa, thresholdIncome, adjustedIncome, remainingLSA } = settings;
  checkRange(budget, 0, 1_000_000, 'an annual budget');
  checkRange(age, 18, 100, 'an age');
  checkRange(years, 1, 70, 'an investment horizon');
  if (!Number.isInteger(age) || !Number.isInteger(years)) throw new RangeError('Use whole years.');
  checkRange(annualReturn, -1, 1, 'an annual return');
  if (![0.2, 0.4, 0.45, 0.6].includes(relief) || ![0, 0.2, 0.4].includes(retirementTax)) {
    throw new RangeError('Choose a supported tax rate.');
  }
  if (lisaExit === 'home') checkRange(price, 1, 100_000_000, 'a home price');
  checkRange(pensionHeadroom, 0, ANNUAL_ALLOWANCE, 'remaining annual pension headroom');
  checkRange(remainingLSA, 0, LUMP_SUM_ALLOWANCE, 'remaining lump sum allowance');
  checkRange(thresholdIncome, 0, 10_000_000, 'threshold income');
  checkRange(adjustedIncome, 0, 10_000_000, 'adjusted income');
  if (salarySacrifice) {
    if (![0, 0.02, 0.08].includes(employeeNI)) throw new RangeError('Choose an employee NI rate.');
    checkRange(sacrificeLimit, 0, 10_000_000, 'available salary sacrifice');
  } else {
    checkRange(relevantEarnings, 0, 10_000_000, 'relevant UK earnings');
  }

  const allowance = Math.min(annualAllowance(thresholdIncome, adjustedIncome),
    pensionHeadroom, mpaa ? MPAA : ANNUAL_ALLOWANCE);
  const canOpenLisa = age < 40 || hasLisa;
  const growth = 1 + annualReturn;
  const isa = { account: 0, cash: 0 };
  const lisa = { account: 0, isaBalance: 0, cash: 0 };
  const pension = { account: 0, isaBalance: 0, cash: 0 };
  const isaDeposit = Math.min(budget, ISA_LIMIT);
  let lisaYears = 0;

  for (let year = 0; year < years; year += 1) {
    const contributionAge = age + year;
    const lisaDeposit = canOpenLisa && contributionAge < 50 ? Math.min(budget, LISA_LIMIT) : 0;
    const lisaIsaDeposit = Math.min(budget - lisaDeposit, ISA_LIMIT - lisaDeposit);
    const cap = salarySacrifice ? allowance : Math.min(
      allowance, contributionAge < 75 ? Math.max(3600, relevantEarnings) : 0
    );
    const deposit = salarySacrifice
      ? pensionDeposit(budget, relief, employeeNI, shareEmployerNI ? EMPLOYER_NI : 0,
        cap, year < 3 ? Infinity : 2000, sacrificeLimit)
      : pensionDeposit(budget, relief, 0, 0, cap);
    const pensionIsaDeposit = Math.min(budget - deposit.netUsed, ISA_LIMIT);

    isa.account = isa.account * growth + isaDeposit;
    isa.cash += budget - isaDeposit;
    lisa.account = lisa.account * growth + lisaDeposit * (1 + LISA_BONUS);
    lisa.isaBalance = lisa.isaBalance * growth + lisaIsaDeposit;
    lisa.cash += budget - lisaDeposit - lisaIsaDeposit;
    lisaYears += Number(lisaDeposit > 0);
    pension.account = pension.account * growth + deposit.gross;
    pension.isaBalance = pension.isaBalance * growth + pensionIsaDeposit;
    pension.cash += budget - deposit.netUsed - pensionIsaDeposit;

    if (year === 0) {
      isa.firstDeposit = isaDeposit;
      lisa.firstDeposit = lisaDeposit * (1 + LISA_BONUS);
      pension.firstDeposit = deposit.gross;
    }
  }

  const endAge = age + years;
  const actualLisaExit = lisaExit === 'later' && endAge < 60 ? 'early' : lisaExit;
  // All comparison withdrawals are after at least one year, so their date is after October 2026.
  lisa.charge = lisa.account * lisaCharge(actualLisaExit, price, '2026-10-29');
  lisa.total = lisa.account - lisa.charge + lisa.isaBalance + lisa.cash;
  isa.total = isa.account + isa.cash;
  pension.withdrawal = pensionWithdrawal(pension.account, retirementTax, remainingLSA);
  pension.minimumAge = years >= 2 ? 57 : 55;
  pension.locked = endAge < pension.minimumAge && pension.account > 0;
  pension.projected = pension.withdrawal.net + pension.isaBalance + pension.cash;
  pension.total = pension.locked ? pension.isaBalance + pension.cash : pension.projected;
  const totals = { isa: isa.total, lisa: lisa.total, pension: pension.total };
  const toPence = amount => Math.round(amount * 100);
  const highest = Math.max(...Object.values(totals).map(toPence));
  const winners = Object.keys(totals).filter(key => toPence(totals[key]) === highest);

  return { isa, lisa, pension, winners, endAge, lisaYears, actualLisaExit };
}
