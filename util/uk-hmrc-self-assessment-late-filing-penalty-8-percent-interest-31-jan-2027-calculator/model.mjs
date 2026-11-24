// UK HMRC Statutory Self Assessment Penalties & Interest Rules (Finance Act 2009 Sch 55 & 56)
// Official rate as of 24 Nov 2026: Bank of England Base (4.00%) + 4.00% = 8.00% p.a.

export const HMRC_STATUTORY_CONSTANTS = {
  defaultInterestRate: 0.0800, // 8.00% p.a.
  filingInitialPenalty: 100, // £100 fixed penalty (even if £0 owed)
  filingDailyRate: 10, // £10/day for up to 90 days after 3 months
  filingDailyMaxDays: 90, // max £900
  filing6MonthMin: 300,
  filing6MonthPct: 0.05,
  filing12MonthMin: 300,
  filing12MonthPct: 0.05,
  paymentPenaltyPct30Days: 0.05, // 5% at 30 days
  paymentPenaltyPct6Months: 0.05, // +5% at 6 months
  paymentPenaltyPct12Months: 0.05 // +5% at 12 months
};

export function calcFilingPenalties(daysLate, unpaidTax) {
  if (daysLate <= 0) return { totalFilingPenalty: 0, breakdown: [] };

  const breakdown = [];
  let total = 0;

  // 1 day late (1 Feb 2027): £100 automatic
  if (daysLate >= 1) {
    total += HMRC_STATUTORY_CONSTANTS.filingInitialPenalty;
    breakdown.push({ tier: '1 Day Late (1 Feb)', amount: 100, note: 'Immediate £100 fixed fine (even if £0 tax owed)' });
  }

  // 3 months late (from 1 May 2027 / 90 days): £10/day for up to 90 days
  if (daysLate > 90) {
    const dailyDays = Math.min(daysLate - 90, HMRC_STATUTORY_CONSTANTS.filingDailyMaxDays);
    const dailyTotal = dailyDays * HMRC_STATUTORY_CONSTANTS.filingDailyRate;
    total += dailyTotal;
    breakdown.push({ tier: `3 Months Late (${dailyDays} days)`, amount: dailyTotal, note: `£10/day for ${dailyDays} days (max £900)` });
  }

  // 6 months late (from 1 Aug 2027 / 181 days): greater of £300 or 5% of unpaid tax
  if (daysLate >= 181) {
    const p6m = Math.max(HMRC_STATUTORY_CONSTANTS.filing6MonthMin, unpaidTax * HMRC_STATUTORY_CONSTANTS.filing6MonthPct);
    total += p6m;
    breakdown.push({ tier: '6 Months Late (1 Aug)', amount: p6m, note: `Greater of £300 or 5% of unpaid tax (£${p6m.toFixed(0)})` });
  }

  // 12 months late (from 1 Feb 2028 / 365 days): greater of £300 or 5% of unpaid tax
  if (daysLate >= 365) {
    const p12m = Math.max(HMRC_STATUTORY_CONSTANTS.filing12MonthMin, unpaidTax * HMRC_STATUTORY_CONSTANTS.filing12MonthPct);
    total += p12m;
    breakdown.push({ tier: '12 Months Late (1 Feb 2028)', amount: p12m, note: `Greater of £300 or 5% of unpaid tax (£${p12m.toFixed(0)})` });
  }

  return { totalFilingPenalty: total, breakdown };
}

export function calcPaymentPenalties(daysLatePayment, unpaidTax, hasTimeToPayBefore30Days = false) {
  if (daysLatePayment <= 0 || unpaidTax <= 0) {
    return { totalPaymentPenalty: 0, ttpSavings: 0, breakdown: [] };
  }

  const breakdown = [];
  let potentialSurcharges = 0;

  // 30 days late (from 3 March 2027): 5%
  if (daysLatePayment >= 30) {
    potentialSurcharges += unpaidTax * HMRC_STATUTORY_CONSTANTS.paymentPenaltyPct30Days;
    breakdown.push({ tier: '30 Days Late (3 March)', rate: '5%', amount: unpaidTax * 0.05, note: '5% of unpaid tax surcharge' });
  }

  // 6 months late (181 days): additional 5%
  if (daysLatePayment >= 181) {
    potentialSurcharges += unpaidTax * HMRC_STATUTORY_CONSTANTS.paymentPenaltyPct6Months;
    breakdown.push({ tier: '6 Months Late (1 Aug)', rate: '+5%', amount: unpaidTax * 0.05, note: 'Additional 5% of unpaid tax surcharge' });
  }

  // 12 months late (365 days): additional 5%
  if (daysLatePayment >= 365) {
    potentialSurcharges += unpaidTax * HMRC_STATUTORY_CONSTANTS.paymentPenaltyPct12Months;
    breakdown.push({ tier: '12 Months Late (1 Feb 2028)', rate: '+5%', amount: unpaidTax * 0.05, note: 'Additional 5% of unpaid tax surcharge' });
  }

  if (hasTimeToPayBefore30Days) {
    return {
      totalPaymentPenalty: 0,
      ttpSavings: potentialSurcharges,
      breakdown: breakdown.map(b => ({ ...b, waivedByTTP: true }))
    };
  }

  return {
    totalPaymentPenalty: potentialSurcharges,
    ttpSavings: 0,
    breakdown: breakdown.map(b => ({ ...b, waivedByTTP: false }))
  };
}

export function calcHmrcInterest(unpaidTax, daysLatePayment, annualInterestRate = 0.0800) {
  if (unpaidTax <= 0 || daysLatePayment <= 0) return 0;
  // Daily simple interest: tax * (rate / 365) * days
  return unpaidTax * (annualInterestRate / 365) * daysLatePayment;
}

export function calcHmrcPenaltiesAndInterest(inputs) {
  const {
    unpaidTax = 4000,
    daysLateFiling = 45,
    daysLatePayment = 45,
    hasTimeToPayBefore30Days = false,
    annualInterestRate = 0.0800
  } = inputs;

  if (unpaidTax < 0 || isNaN(unpaidTax)) throw new RangeError('Unpaid tax must be non-negative');
  if (daysLateFiling < 0 || isNaN(daysLateFiling)) throw new RangeError('Days late filing must be non-negative');
  if (daysLatePayment < 0 || isNaN(daysLatePayment)) throw new RangeError('Days late payment must be non-negative');
  if (annualInterestRate < 0 || isNaN(annualInterestRate)) throw new RangeError('Interest rate must be positive');

  const filingRes = calcFilingPenalties(daysLateFiling, unpaidTax);
  const paymentRes = calcPaymentPenalties(daysLatePayment, unpaidTax, hasTimeToPayBefore30Days);
  const interestAccrued = calcHmrcInterest(unpaidTax, daysLatePayment, annualInterestRate);

  const totalExtraHmrcBill = filingRes.totalFilingPenalty + paymentRes.totalPaymentPenalty + interestAccrued;
  const totalDueToHmrc = unpaidTax + totalExtraHmrcBill;

  return {
    unpaidTax,
    daysLateFiling,
    daysLatePayment,
    annualInterestRate,
    filing: filingRes,
    payment: paymentRes,
    interest: {
      annualRatePct: annualInterestRate * 100,
      dailyRatePct: (annualInterestRate / 365) * 100,
      interestAccrued: Math.round(interestAccrued * 100) / 100
    },
    totals: {
      totalExtraHmrcBill: Math.round(totalExtraHmrcBill * 100) / 100,
      totalDueToHmrc: Math.round(totalDueToHmrc * 100) / 100,
      ttpSavings: Math.round(paymentRes.ttpSavings * 100) / 100
    }
  };
}
