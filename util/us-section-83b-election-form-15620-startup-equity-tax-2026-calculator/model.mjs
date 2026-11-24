const NIIT_RATE = 3.8;
const MAX_FICA_RATE = 8.55;
const YEARS = 4;

export function isEligible(equityType) {
  return equityType === 'founder' || equityType === 'early-nso';
}

function calendarDate(year, month, day) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function dateKey(date) {
  return date.toISOString().split('T')[0];
}

function addDays(date, count) {
  return calendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate() + count);
}

function observedDate(year, month, day) {
  const date = calendarDate(year, month, day);
  if (date.getUTCDay() === 6) return addDays(date, -1);
  if (date.getUTCDay() === 0) return addDays(date, 1);
  return date;
}

function ordinalWeekday(year, month, weekday, ordinal) {
  const first = calendarDate(year, month, 1);
  return addDays(first, (weekday - first.getUTCDay() + 7) % 7 + (ordinal - 1) * 7);
}

function filingHolidays(year) {
  const mayEnd = calendarDate(year, 5, 31);
  const dates = [
    observedDate(year, 1, 1), ordinalWeekday(year, 1, 1, 3),
    ordinalWeekday(year, 2, 1, 3), observedDate(year, 4, 16),
    addDays(mayEnd, -((mayEnd.getUTCDay() + 6) % 7)),
    observedDate(year, 7, 4), ordinalWeekday(year, 9, 1, 1),
    ordinalWeekday(year, 10, 1, 2), observedDate(year, 11, 11),
    ordinalWeekday(year, 11, 4, 4), observedDate(year, 12, 25),
    observedDate(year + 1, 1, 1)
  ];
  if (year >= 2021) dates.push(observedDate(year, 6, 19));
  if (year >= 1969 && (year - 1969) % 4 === 0) {
    const inauguration = calendarDate(year, 1, 20);
    dates.push(inauguration.getUTCDay() === 0 ? addDays(inauguration, 1) : inauguration);
  }
  return new Set(dates.map(dateKey));
}

export function filingDates(transferDate) {
  if (typeof transferDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(transferDate)) return null;
  const [year, month, day] = transferDate.split('-').map(Number);
  if (year < 1900 || year > 9998) return null;
  const transfer = calendarDate(year, month, day);
  if (dateKey(transfer) !== transferDate) return null;
  const nominal = addDays(transfer, 30);
  let due = nominal;
  const holidays = filingHolidays(nominal.getUTCFullYear());
  while (due.getUTCDay() === 0 || due.getUTCDay() === 6 || holidays.has(dateKey(due))) {
    due = addDays(due, 1);
  }
  return { day30: dateKey(nominal), deadline: dateKey(due) };
}

function validNumber(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function validLots(values, validValue) {
  return Array.isArray(values) && values.length === YEARS && Array.from(values).every(validValue);
}

function compensationLot(shares, fmv, pricePaid, incomeRate, ficaRate) {
  const compensation = Math.max(0, fmv - pricePaid) * shares;
  const incomeTax = compensation * incomeRate / 100;
  const payrollTax = compensation * ficaRate / 100;
  return {
    shares, compensation, incomeTax, payrollTax,
    basisPerShare: Math.max(fmv, pricePaid),
    compensationTax: incomeTax + payrollTax
  };
}

function sale(lots, exitPrice, incomeRate, ltcgRate, niit) {
  let longGain = 0;
  let shortGain = 0;
  for (const lot of lots) {
    const gain = (exitPrice - lot.basisPerShare) * lot.shares;
    if (lot.longTerm) longGain += gain;
    else shortGain += gain;
  }

  // Within this stock sale, losses offset gains of the opposite holding period.
  const netLongGain = Math.max(0, longGain + Math.min(0, shortGain));
  const netShortGain = Math.max(0, shortGain + Math.min(0, longGain));
  const niitTax = (netLongGain + netShortGain) * (niit ? NIIT_RATE : 0) / 100;
  return {
    saleGain: longGain + shortGain,
    niitTax,
    saleTax: (netLongGain * ltcgRate + netShortGain * incomeRate) / 100 + niitTax
  };
}

export function calculate({
  equityType, shares, pricePaid, transferFmv, vestFmvs, exitPrice,
  incomeRate, ficaRate, ltcgRate, niit, transferLongTerm, vestLongTerm
}) {
  if (!isEligible(equityType)) throw new RangeError('Choose qualifying restricted stock.');
  const validPrice = value => validNumber(value, 0, 1e9);
  if (!Number.isSafeInteger(shares) || shares < 1 || shares > 1e9 ||
      ![pricePaid, transferFmv, exitPrice].every(validPrice) || !validLots(vestFmvs, validPrice)) {
    throw new RangeError('Enter whole shares and nonnegative share prices within the displayed limits.');
  }
  const isBoolean = value => typeof value === 'boolean';
  if (!validNumber(incomeRate, 0, 100) || !validNumber(ficaRate, 0, MAX_FICA_RATE) ||
      incomeRate + ficaRate > 100 || ![15, 20].includes(ltcgRate) ||
      !isBoolean(niit) || !isBoolean(transferLongTerm) || !validLots(vestLongTerm, isBoolean)) {
    throw new RangeError('Check the rates and holding periods. Combined compensation rates must be 100% or less.');
  }

  const transfer = compensationLot(shares, transferFmv, pricePaid, incomeRate, ficaRate);
  const vesting = vestFmvs.map((fmv, index) => {
    const lotShares = Math.round(shares * (index + 1) / YEARS) - Math.round(shares * index / YEARS);
    return {
      ...compensationLot(lotShares, fmv, pricePaid, incomeRate, ficaRate),
      year: index + 1, fmv, electionTax: 0, longTerm: vestLongTerm[index]
    };
  });
  const electedSale = sale([{ ...transfer, longTerm: transferLongTerm }], exitPrice, incomeRate, ltcgRate, niit);
  const standardSale = sale(vesting, exitPrice, incomeRate, ltcgRate, niit);
  const vestTax = vesting.reduce((total, lot) => total + lot.compensationTax, 0);
  const withElection = { ...transfer, ...electedSale, totalTax: transfer.compensationTax + electedSale.saleTax };
  const withoutElection = { ...standardSale, totalTax: vestTax + standardSale.saleTax };

  return {
    withElection, withoutElection, vesting,
    netExitTaxSaved: withoutElection.totalTax - withElection.totalTax,
    illiquidVestTimeCashTaxAvoided: vestTax,
    upfrontTaxAtRisk: transfer.compensationTax,
    zeroRecoveryForfeitureLoss: pricePaid * shares,
    zeroExitVestedLossWithElection: transfer.basisPerShare * shares,
    zeroExitVestedLossWithoutElection: vesting.reduce((total, lot) => total + lot.basisPerShare * lot.shares, 0)
  };
}
