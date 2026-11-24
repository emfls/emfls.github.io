const SAVINGS_CAP = 6_000_000;
const COMBINED_CAP = 9_000_000;
const ISA_EXTRA_CAP = 3_000_000;
const TAX_YEAR = 2026;
const DAY = 86_400_000;

export function parseDecimal(raw, { scale = 1, min = 0, max = 1_000_000_000_000 } = {}) {
  const text = raw.trim().replace(/^−/, '-');
  if (!/^-?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)$/.test(text)) return null;

  const [whole, fraction = ''] = text.replace(/,/g, '').split('.');
  const precision = Math.log10(scale);
  if (fraction.replace(/0+$/, '').length > precision) return null;
  const units = Number(whole || 0) * scale;
  const decimal = Number(fraction.slice(0, precision).padEnd(precision, '0'));
  const value = text.startsWith('-') ? units - decimal : units + decimal;
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

function calendarDay(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const stamp = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== date) return null;
  return stamp / DAY;
}

export function calculateCredit({
  incomeType, income, savings, irp, isaSavings, isaIrp, maturity, transfer, priorExtra, taxCapacity
}) {
  const lowRate = income <= (incomeType === 'salary' ? 55_000_000 : 45_000_000);
  const percentTenths = lowRate ? 165 : 132;
  const isaAmount = isaSavings + isaIrp;
  let days = null;
  let isaStatus = 'none';
  if (isaAmount > 0) {
    const maturityDay = calendarDay(maturity);
    const transferDay = calendarDay(transfer);
    if (maturityDay === null || transferDay === null) {
      isaStatus = 'missing-date';
    } else {
      days = transferDay - maturityDay;
      if (days < 0 || days > 60) isaStatus = 'outside-window';
      else if (Number(transfer.slice(0, 4)) !== TAX_YEAR) isaStatus = 'other-year';
      else isaStatus = 'eligible';
    }
  }

  const qualified = isaStatus === 'eligible';
  const savingsTotal = savings + (qualified ? isaSavings : 0);
  const irpTotal = irp + (qualified ? isaIrp : 0);
  const base = Math.min(COMBINED_CAP, Math.min(SAVINGS_CAP, savingsTotal) + irpTotal);
  const remainingIsaCap = ISA_EXTRA_CAP - (qualified && maturity.startsWith('2025-') ? priorExtra : 0);
  const isaLimit = qualified ? Math.min(Math.floor(isaAmount / 10), remainingIsaCap) : 0;
  const extra = Math.min(isaLimit, savingsTotal + irpTotal - base);
  const eligible = base + extra;
  const maximumCredit = Math.floor(eligible * percentTenths / 1000);

  return {
    rate: percentTenths / 1000, base, isaLimit, extra, eligible, maximumCredit, days, isaStatus,
    usableCredit: taxCapacity === null ? null : Math.min(maximumCredit, taxCapacity)
  };
}

export function calculateEarlyWithdrawal({ creditedPrincipal, uncreditedPrincipal, gain, creditReceived }) {
  const original = creditedPrincipal + uncreditedPrincipal;
  const balance = original + gain;
  if (balance < 0) return null;

  const taxBase = Math.max(0, balance - uncreditedPrincipal);
  const tax = Math.floor(taxBase * 165 / 1000);
  const cash = balance - tax;
  const taxDifference = creditReceived - tax;
  return { taxBase, tax, cash, taxDifference, netProfit: gain + taxDifference };
}

export function pensionRate(age) {
  if (age < 55) return null;
  if (age < 70) return 0.055;
  if (age < 80) return 0.044;
  return 0.033;
}

export function compareGrowth({ principal, annualRate, age }) {
  const rate = pensionRate(age);
  if (rate === null || annualRate < -1) return null;
  const generalFactor = 1 + annualRate - Math.max(0, annualRate) * 0.154;

  return Array.from({ length: 21 }, (_, year) => ({
    year,
    pension: Math.round(principal * (1 + annualRate) ** year * (1 - rate)),
    general: Math.round(principal * generalFactor ** year)
  }));
}
