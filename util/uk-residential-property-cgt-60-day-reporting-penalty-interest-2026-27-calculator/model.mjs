const DAY = 86_400_000;
const ANNUAL_PAYMENT_DATE = '2028-01-31';
const BASIC_RATE_BAND = 37_700;
const MAX_EXEMPTION = 3_000;
const MAX_AMOUNT = 1_000_000_000;

function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError('Enter a valid date in each date field.');
  }
  const timestamp = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(timestamp) || isoDate(timestamp) !== value) {
    throw new RangeError('Enter a valid calendar date.');
  }
  return timestamp;
}

function isoDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function addMonths(timestamp, months) {
  const date = new Date(timestamp);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months + 1, 0);
  date.setUTCDate(Math.min(day, date.getUTCDate()));
  return date.getTime();
}

function numberInRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(label + ' must be between ' + min.toLocaleString('en-GB') +
      ' and ' + max.toLocaleString('en-GB') + '.');
  }
}

function pounds(pennies) {
  return Math.round(pennies) / 100;
}

export function propertyDeadline(completionDate) {
  return isoDate(dateValue(completionDate) + 60 * DAY);
}

export function calculateTax({ gain, taxableIncome, exemption }) {
  numberInRange(gain, -MAX_AMOUNT, MAX_AMOUNT, 'Net gain');
  numberInRange(taxableIncome, 0, MAX_AMOUNT, 'Taxable income and band already used');
  numberInRange(exemption, 0, MAX_EXEMPTION, 'Available exemption');
  const taxableGain = Math.max(0, Math.round(gain * 100) - Math.round(exemption * 100));
  const basicRoom = Math.max(0, BASIC_RATE_BAND * 100 - Math.round(taxableIncome * 100));
  const basicGain = Math.min(taxableGain, basicRoom);
  const higherGain = taxableGain - basicGain;
  return {
    cgtDue: pounds((basicGain * 18 + higherGain * 24) / 100),
    basicGain: pounds(basicGain),
    higherGain: pounds(higherGain)
  };
}

export function filingPenalties({ deadline, date, cgtDue, mode, dailyPenalties }) {
  const due = dateValue(deadline);
  const filed = dateValue(date);
  const first = due + DAY;
  let dates;
  if (mode === 'calendar') {
    dates = [3, 6, 12].map(months => addMonths(first, months));
  } else if (mode === 'fixed') {
    dates = [91, 181, 366].map(days => due + days * DAY);
  } else {
    throw new RangeError('Choose a filing penalty scenario.');
  }
  const [dailyStart, sixMonthStart, twelveMonthStart] = dates;
  const initial = filed >= first ? 100 : 0;
  const dailyDays = dailyPenalties ? Math.min(90, Math.max(0, (filed - dailyStart) / DAY + 1)) : 0;
  const daily = dailyDays * 10;
  const tier = Math.max(300, pounds(Math.round(cgtDue * 100) * 5 / 100));
  const sixMonth = filed >= sixMonthStart ? tier : 0;
  const twelveMonth = filed >= twelveMonthStart ? tier : 0;
  return {
    initial, daily, dailyDays, sixMonth, twelveMonth,
    dates: [first, ...dates].map(isoDate),
    total: pounds((initial + daily + sixMonth + twelveMonth) * 100)
  };
}

export function paymentPenalties({ deadline, date, cgtDue, mode }) {
  const paid = dateValue(date);
  let dates;
  if (mode === 'annual') {
    const first = dateValue(ANNUAL_PAYMENT_DATE) + 31 * DAY;
    dates = [first, addMonths(first, 5), addMonths(first, 11)];
  } else if (mode === 'stress') {
    dates = [30, 180, 365].map(days => dateValue(deadline) + days * DAY);
  } else {
    throw new RangeError('Choose a payment penalty scenario.');
  }
  const tier = pounds(Math.round(cgtDue * 100) * 5 / 100);
  const amounts = dates.map(trigger => paid >= trigger ? tier : 0);
  return { dates: dates.map(isoDate), amounts, total: pounds(amounts.reduce((sum, amount) => sum + amount, 0) * 100) };
}

export function calculate({
  disposalDate, completionDate, filingDate, paymentDate, gain, taxableIncome, exemption,
  residency, baseRate, filingMode, paymentMode, dailyPenalties
}) {
  const disposal = dateValue(disposalDate);
  const completion = dateValue(completionDate);
  const filed = dateValue(filingDate);
  const paid = dateValue(paymentDate);
  if (disposal < dateValue('2026-04-06') || disposal > dateValue('2027-04-05')) {
    throw new RangeError('Enter a disposal date from 6 April 2026 to 5 April 2027.');
  }
  if (completion < disposal || filed < completion || paid < completion) {
    throw new RangeError('Completion must follow or match disposal. Filing and payment cannot precede completion.');
  }
  if (!['uk', 'non-uk'].includes(residency)) {
    throw new RangeError('Choose your UK tax residency.');
  }
  numberInRange(baseRate, -4, 100, 'Bank Rate');
  const tax = calculateTax({ gain, taxableIncome, exemption });
  const { cgtDue } = tax;
  const deadline = propertyDeadline(completionDate);
  const due = dateValue(deadline);
  const filingDaysLate = Math.max(0, (filed - due) / DAY);
  const paymentDaysLate = Math.max(0, (paid - due) / DAY);
  const filingRequired = residency === 'non-uk' || tax.basicGain + tax.higherGain > 0;
  const filing = filingPenalties({
    deadline, date: filingRequired ? filingDate : deadline, cgtDue, mode: filingMode, dailyPenalties
  });
  const laterFilingTotal = filingRequired ? filingPenalties({
    deadline, date: isoDate(filed + 30 * DAY), cgtDue, mode: filingMode, dailyPenalties
  }).total : 0;
  const payment = paymentPenalties({ deadline, date: paymentDate, cgtDue, mode: paymentMode });
  const interestRate = baseRate + 4;
  const dailyInterestPennies = Math.round(cgtDue * 100) * interestRate / 100 / 365;
  const interest = pounds(dailyInterestPennies * paymentDaysLate);
  const additionalLateDays = Math.max(0, (paid + 30 * DAY - due) / DAY) - paymentDaysLate;
  return {
    ...tax, deadline, filingRequired, filingDaysLate, paymentDaysLate, filing, payment,
    interestRate, interest,
    extraCost: pounds((filing.total + payment.total + interest) * 100),
    next30DaysFiling: pounds((laterFilingTotal - filing.total) * 100),
    next30DaysInterest: pounds(dailyInterestPennies * additionalLateDays)
  };
}
