const rates = [10, 12, 22, 24, 32, 35, 37];
const schedules = {
  single: { deduction: 16100, limits: [12400, 50400, 105700, 201775, 256225, 640600] },
  joint: { deduction: 32200, limits: [24800, 100800, 211400, 403550, 512450, 768700] },
  separate: { deduction: 16100, limits: [12400, 50400, 105700, 201775, 256225, 384350] },
  head: { deduction: 24150, limits: [17700, 67450, 105700, 201750, 256200, 640600] },
};

const PLAN_WITHHOLDING_PCT = 20;
const IRA_ADDITIONAL_TAX_PCT = 10;
const MAX_DOLLARS = 100_000_000;

function inRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}.`);
  }
  return value;
}

function toCents(value) {
  return Math.round(value * 100);
}

function portion(cents, percent) {
  return Math.round(cents * toCents(percent) / 10_000);
}

export function federalTax2026(taxableIncome, filingStatus) {
  if (!Object.hasOwn(schedules, filingStatus)) throw new RangeError('Select a 2026 filing status.');
  inRange(taxableIncome, 0, 2 * MAX_DOLLARS, 'Taxable income');
  const { limits } = schedules[filingStatus];
  const incomeCents = toCents(taxableIncome);
  let lower = 0;
  let taxTimes100 = 0;
  for (const [index, rate] of rates.entries()) {
    const upper = (limits[index] ?? Infinity) * 100;
    taxTimes100 += (Math.min(incomeCents, upper) - lower) * rate;
    if (incomeCents <= upper) break;
    lower = upper;
  }
  return Math.round(taxTimes100 / 100) / 100;
}

export function calculateQdro({
  award, cash, age, filingStatus, otherIncome, stateTaxPct,
  stateWithholdingPct, iraWithholdingPct, annualGrowthPct,
}) {
  const awardCents = toCents(inRange(award, 0, MAX_DOLLARS, 'QDRO award'));
  const cashCents = toCents(inRange(cash, 0, award, 'Gross cash'));
  inRange(age, 18, 120, 'Age at withdrawal');
  inRange(otherIncome, 0, MAX_DOLLARS, 'Other ordinary income');
  inRange(stateTaxPct, 0, 100, 'State tax rate');
  inRange(stateWithholdingPct, 0, 100 - PLAN_WITHHOLDING_PCT, 'State withholding rate');
  inRange(iraWithholdingPct, 0, 100 - stateWithholdingPct, 'IRA federal withholding rate');
  inRange(annualGrowthPct, -100, 100, 'Annual return');
  if (!Object.hasOwn(schedules, filingStatus)) throw new RangeError('Select a 2026 filing status.');

  const { deduction } = schedules[filingStatus];
  const baseIncome = toCents(otherIncome) - toCents(deduction);
  const federalTaxBefore = federalTax2026(Math.max(0, baseIncome) / 100, filingStatus);
  const federalTaxAfter = federalTax2026(Math.max(0, baseIncome + cashCents) / 100, filingStatus);
  const federalTaxCents = toCents(federalTaxAfter - federalTaxBefore);
  const stateTaxCents = portion(cashCents, stateTaxPct);
  const iraPenalty = age < 59.5 ? portion(cashCents, IRA_ADDITIONAL_TAX_PCT) : 0;
  const yearsTo65 = Math.max(0, 65 - age);

  function scenario(gross, federalWithholdingPct, federalTax, stateTax, penalty) {
    const federalWithholding = portion(gross, federalWithholdingPct);
    // Keep the combined withholding within the distribution after rounding to cents.
    const stateWithholding = Math.min(gross - federalWithholding, portion(gross, stateWithholdingPct));
    const immediateNet = gross - federalWithholding - stateWithholding;
    const federalSettlement = federalWithholding - federalTax - penalty;
    const stateSettlement = stateWithholding - stateTax;
    const finalNet = immediateNet + federalSettlement + stateSettlement;
    const rollover = (awardCents - gross) / 100;
    const growthFactor = 1 + annualGrowthPct / 100;
    return {
      gross: gross / 100,
      federalWithholding: federalWithholding / 100,
      stateWithholding: stateWithholding / 100,
      immediateNet: immediateNet / 100,
      federalTax: federalTax / 100,
      stateTax: stateTax / 100,
      penalty: penalty / 100,
      federalSettlement: federalSettlement / 100,
      stateSettlement: stateSettlement / 100,
      finalNet: finalNet / 100,
      rollover,
      projectedAt65: toCents(rollover * growthFactor ** yearsTo65) / 100,
      projectedIn20Years: toCents(rollover * growthFactor ** 20) / 100,
    };
  }

  return {
    yearsTo65,
    penaltySaved: iraPenalty / 100,
    direct: scenario(cashCents, PLAN_WITHHOLDING_PCT, federalTaxCents, stateTaxCents, 0),
    ira: scenario(cashCents, iraWithholdingPct, federalTaxCents, stateTaxCents, iraPenalty),
    full: scenario(0, 0, 0, 0, 0),
  };
}
