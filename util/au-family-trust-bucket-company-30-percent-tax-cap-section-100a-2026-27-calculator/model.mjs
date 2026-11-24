export const MAX_AMOUNT = 100_000_000;

const RESIDENT_BRACKETS = [
  [0, 0],
  [18_200, 0.15],
  [45_000, 0.30],
  [135_000, 0.37],
  [190_000, 0.45],
];
const MEDICARE_THRESHOLD = 28_011;
const MEDICARE_RATE = 0.02;
const MEDICARE_PHASE_IN = 0.10;
const SECTION_100A_RATE = 0.47;
const TAX_BREAKPOINTS = [
  ...RESIDENT_BRACKETS.slice(1).map(([threshold]) => threshold),
  MEDICARE_THRESHOLD,
  MEDICARE_THRESHOLD * 1.25,
].sort((a, b) => a - b);

function toCents(value) {
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT || cents / 100 !== value) {
    throw new RangeError('Enter amounts between A$0 and A$100 million with up to two decimal places.');
  }
  return cents;
}

export function residentTax(income) {
  if (!Number.isFinite(income) || income < 0) {
    throw new RangeError('Taxable income must be a finite, non-negative number.');
  }
  const incomeTax = RESIDENT_BRACKETS.reduce((tax, [start, rate], index) => {
    const end = RESIDENT_BRACKETS[index + 1]?.[0] ?? Infinity;
    return tax + Math.max(0, Math.min(income, end) - start) * rate;
  }, 0);
  const medicareLevy = Math.min(
    income * MEDICARE_RATE,
    Math.max(0, income - MEDICARE_THRESHOLD) * MEDICARE_PHASE_IN,
  );
  return { incomeTax, medicareLevy, total: incomeTax + medicareLevy };
}

function optimise(total, recipients) {
  let bestTax = Infinity;
  let bestAllocation;
  const allocation = recipients.map(() => 0);

  // A piecewise-linear minimum occurs at a vertex: all but one recipient
  // are at a tax breakpoint or zero. The last receives the balance.
  for (const [flexIndex, flex] of recipients.entries()) {
    function visit(index, remaining, tax) {
      if (index === recipients.length) {
        allocation[flexIndex] = remaining;
        const groupTax = tax + flex.tax(remaining);
        if (groupTax < bestTax - 1e-7) {
          bestTax = groupTax;
          bestAllocation = [...allocation];
        }
        return;
      }
      if (index === flexIndex) {
        visit(index + 1, remaining, tax);
        return;
      }
      const recipient = recipients[index];
      for (const amount of recipient.breakpoints) {
        if (amount > remaining) break;
        allocation[index] = amount;
        visit(index + 1, remaining - amount, tax + recipient.tax(amount));
      }
    }
    visit(0, total, 0);
  }
  return { tax: bestTax, allocations: bestAllocation.map(cents => cents / 100) };
}

export function compareStrategies({ trustIncome, adultIncomes, companyRate }) {
  const total = toCents(trustIncome);
  if (!Array.isArray(adultIncomes) || ![2, 3].includes(adultIncomes.length)) {
    throw new RangeError('Enter existing income for two or three adult beneficiaries.');
  }
  if (companyRate !== 0.30 && companyRate !== 0.25) {
    throw new RangeError('Select the 30% or 25% company rate.');
  }
  const incomes = Array.from(adultIncomes, toCents);
  const adults = incomes.map(income => {
    const baseline = residentTax(income / 100).total;
    return {
      breakpoints: [0, ...TAX_BREAKPOINTS.map(amount => amount * 100 - income)
        .filter(amount => amount > 0 && amount <= total)],
      tax: amount => residentTax((income + amount) / 100).total - baseline,
    };
  });
  const noBucket = optimise(total, adults);
  const topEarner = incomes.indexOf(Math.max(...incomes));
  const company = { breakpoints: [0], tax: amount => amount / 100 * companyRate };
  const combined = optimise(total, [...adults, company]);
  const companyAllocation = combined.allocations.pop();
  const companyTax = companyAllocation * companyRate;
  const trusteeTax = trustIncome * SECTION_100A_RATE;

  return {
    noBucket: { ...noBucket, topEarnerOnlyTax: adults[topEarner].tax(total) },
    bucket: {
      ...combined,
      companyAllocation,
      companyTax,
      retainedProfit: companyAllocation - companyTax,
      frankingCredits: companyTax,
    },
    section100A: { trusteeTax, extraTaxVsBucket: trusteeTax - combined.tax },
    taxDeferred: Math.max(0, noBucket.tax - combined.tax),
    effectiveRate: total === 0 ? null : combined.tax / trustIncome,
  };
}
