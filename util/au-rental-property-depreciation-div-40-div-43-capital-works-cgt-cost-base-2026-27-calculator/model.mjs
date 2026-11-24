const DAY = 86_400_000;
const WORKS_RATE = 0.025;
const WORKS_YEARS = 40;
const MAX_AMOUNT = 100_000_000_000;

function readDate(value, label) {
  const time = Date.parse(value + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(time)
      || new Date(time).toISOString().slice(0, 10) !== value
      || value < '1900-01-01' || value > '2100-12-31') {
    throw new RangeError(label + ' must be a valid date between 1900 and 2100.');
  }
  return time;
}

function addYears(time, years) {
  const date = new Date(time);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + years);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.getTime();
}

function number(value, label, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(label + ' must be between ' + min + ' and ' + max + '.');
  }
  return value;
}

function overlap(start, end, windowStart, windowEnd) {
  return Math.max(0, (Math.min(end, windowEnd) - Math.max(start, windowStart)) / DAY);
}

export function calculate(input) {
  const acquisition = readDate(input.acquisition, 'Acquisition');
  const sale = readDate(input.sale, 'Sale contract');
  const rentalStart = input.rentalStart ? readDate(input.rentalStart, 'First eligible rental day') : acquisition;
  const rentalEnd = input.rentalEnd ? readDate(input.rentalEnd, 'Last eligible rental day') : sale;
  const start = readDate(input.constructionStart, 'Construction start');
  const complete = readDate(input.constructionComplete, 'Construction completion');
  if (sale < acquisition) throw new RangeError('Sale contract must be on or after acquisition.');
  if (rentalStart < acquisition || rentalEnd < rentalStart) {
    throw new RangeError('Rental dates must be in order and on or after acquisition.');
  }
  if (complete < start) throw new RangeError('Construction completion cannot precede construction start.');

  const cost = number(input.constructionCost, 'Construction cost', 0, MAX_AMOUNT);
  const prior = number(input.priorWorksDeductions, 'Previously deducted capital works', 0, cost);
  const plantCost = number(input.plantCost, 'Plant cost', 0, MAX_AMOUNT);
  const life = number(input.effectiveLife, 'Effective life', 0.01, 100);
  const costBase = number(input.costBase, 'Property cost base', 0, MAX_AMOUNT);
  const proceeds = number(input.proceeds, 'Property sale proceeds', 0, MAX_AMOUNT);
  const losses = number(input.losses, 'Capital losses', 0, MAX_AMOUNT);
  const holdingRate = number(input.holdingRate, 'Holding tax rate', 0, 100) / 100;
  const saleRate = number(input.saleRate, 'Sale tax rate', 0, 100) / 100;
  const returnRate = number(input.reinvestRate, 'Reinvestment rate', -100, 100) / 100;
  if (typeof input.restrictedPlant !== 'boolean' || typeof input.allowDiscount !== 'boolean') {
    throw new RangeError('Plant and discount eligibility must be selected.');
  }
  if (!['dv', 'pc'].includes(input.method)) throw new RangeError('Select a Division 40 method.');
  const plantStart = input.plantStart ? readDate(input.plantStart, 'Plant start') : rentalStart;
  const plantEligible = !input.restrictedPlant && plantCost > 0;
  if (plantEligible && plantStart < rentalStart) throw new RangeError('Plant start cannot precede the first eligible rental day in this model.');
  if (plantEligible && input.method === 'dv' && plantStart < Date.UTC(2006, 4, 10)) {
    throw new RangeError('The 200% diminishing value method covers assets first held from 10 May 2006.');
  }

  const worksEligible = start >= Date.UTC(1987, 8, 16);
  const worksExpiry = addYears(complete, WORKS_YEARS);
  const firstDay = new Date(rentalStart);
  const firstYear = firstDay.getUTCFullYear() - Number(firstDay.getUTCMonth() < 6);
  const rentalEndExclusive = rentalEnd + DAY;
  let worksBalance = cost - prior;
  let plantBalance = plantCost;
  let totalDiv43 = 0;
  let totalDiv40 = 0;
  let reinvestmentGrowth = 0;
  const rows = [];

  for (let year = firstYear; Date.UTC(year, 6, 1) <= rentalEnd; year++) {
    const periodStart = Math.max(rentalStart, Date.UTC(year, 6, 1));
    const periodEnd = Math.min(rentalEndExclusive, Date.UTC(year + 1, 6, 1));
    const worksDays = worksEligible ? overlap(periodStart, periodEnd, complete, worksExpiry) : 0;
    const plantDays = plantEligible ? overlap(periodStart, periodEnd, plantStart, rentalEndExclusive) : 0;
    const div43 = Math.min(worksBalance, cost * WORKS_RATE * worksDays / 365);
    const plantAnnual = input.method === 'dv' ? plantBalance * 2 / life : plantCost / life;
    const div40 = Math.min(plantBalance, plantAnnual * plantDays / 365);
    worksBalance -= div43;
    plantBalance -= div40;
    totalDiv43 += div43;
    totalDiv40 += div40;
    const deduction = div43 + div40;
    const taxSaving = deduction * holdingRate;
    const yearsToSale = Math.max(0, (sale - Date.UTC(year + 1, 5, 30)) / DAY / 365);
    const grownSaving = taxSaving * (1 + returnRate) ** yearsToSale;
    reinvestmentGrowth += grownSaving - taxSaving;

    rows.push({
      year, rentalDays: (periodEnd - periodStart) / DAY,
      div43, div40, deduction, taxSaving, grownSaving,
      plantClosing: plantEligible ? plantBalance : null,
    });
  }

  const totalDeductions = totalDiv43 + totalDiv40;
  const taxSavings = totalDeductions * holdingRate;
  // The property basis only loses deductible construction expenses it includes.
  if (totalDiv43 > costBase) throw new RangeError('The pre-adjustment cost base must cover the Division 43 reduction.');
  const adjustedCostBase = costBase - totalDiv43;
  const cgtInScope = sale >= Date.UTC(2026, 6, 1) && sale < Date.UTC(2027, 6, 1);
  // Exclude acquisition and disposal days from the 12-month test.
  const discountApplied = cgtInScope ? input.allowDiscount && sale > addYears(acquisition, 1) : null;
  const gainFactor = discountApplied ? 0.5 : 1;
  const taxableGainBefore = cgtInScope ? Math.max(0, proceeds - costBase - losses) * gainFactor : null;
  const taxableGainAfter = cgtInScope ? Math.max(0, proceeds - adjustedCostBase - losses) * gainFactor : null;
  const extraCgt = cgtInScope ? (taxableGainAfter - taxableGainBefore) * saleRate : null;
  const netTaxBenefit = cgtInScope ? taxSavings - extraCgt : null;

  return {
    rows, worksEligible, yearOne: rows[0].deduction, totalDiv43, totalDiv40, totalDeductions, taxSavings,
    adjustedCostBase, cgtInScope, discountApplied, taxableGainBefore, taxableGainAfter, extraCgt,
    reinvestmentGrowth, netTaxBenefit,
    netWorksBenefit: cgtInScope ? totalDiv43 * holdingRate - extraCgt : null,
    saleValueBenefit: cgtInScope ? netTaxBenefit + reinvestmentGrowth : null,
  };
}
