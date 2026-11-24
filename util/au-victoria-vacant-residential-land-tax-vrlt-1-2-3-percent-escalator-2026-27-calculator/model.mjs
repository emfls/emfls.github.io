// The general-rate schedule is based on total taxable Victorian site value.
const landTaxBrackets = [
  [3_000_000, 31_650, 265],
  [1_800_000, 11_850, 165],
  [1_000_000, 4_650, 90],
  [600_000, 2_250, 60],
  [300_000, 1_350, 30],
  [100_000, 975, 0],
  [50_000, 500, 0],
  [0, 0, 0],
];

const dollars = value => Math.sign(value) * (Math.round(Math.abs(value) * 100) / 100);
const taxAtRate = (value, basisPoints) => Math.round(Math.round(value * 100) * basisPoints / 10_000) / 100;

export function landTaxStack(siteValue, absentee) {
  const [floor, base, basisPoints] = landTaxBrackets.find(([minimum]) => siteValue >= minimum);
  const landTax = base + taxAtRate(siteValue - floor, basisPoints);
  const surcharge = absentee && siteValue >= 50_000 ? taxAtRate(siteValue, 400) : 0;
  return { landTax, surcharge };
}

export function holidayHomeStatus({ genuineHoliday, australianPpr, holidayDays, notification }) {
  if (!genuineHoliday) return 'not-claimed';
  if (!australianPpr || holidayDays < 28) return 'criteria-unmet';
  return notification === 'timely' || notification === 'existing' ? 'eligible' : 'review';
}

export function estimateHoldingCosts(input) {
  const { propertyType, taxYear, civ, vacancyMonths, liabilityYear, developableMetro,
    undevelopedYears, adjoiningExemption, stack, siteValue, rentalMonths,
    monthlyRent, rentalCosts } = input;
  const dwelling = propertyType === 'dwelling';
  const holidayStatus = dwelling ? holidayHomeStatus(input) : 'not-applicable';
  const taxableDwelling = vacancyMonths > 6 && holidayStatus !== 'eligible';

  let cumulative = 0;
  const schedule = Array.from({ length: 3 }, (_, offset) => {
    const year = taxYear + offset;
    const taxableLand = year >= 2026 && developableMetro && undevelopedYears + offset >= 5 && !adjoiningExemption;
    const ratePercent = dwelling ? (taxableDwelling ? Math.min(liabilityYear + offset, 3) : 0) : Number(taxableLand);
    const tax = taxAtRate(civ, ratePercent * 100);
    cumulative = dollars(cumulative + tax);
    return { year, rate: ratePercent / 100, tax, cumulative };
  });
  const { rate, tax: vrlt } = schedule[0];
  const { landTax, surcharge } = landTaxStack(stack === 'none' ? 0 : siteValue, stack === 'absentee');
  const total = dollars(vrlt + landTax + surcharge);
  const rental = dwelling ? compareRenting({ vrlt, total, rentalMonths, monthlyRent, rentalCosts }) : null;
  return { rate, vrlt, schedule, holidayStatus, landTax, surcharge, total, rental };
}

function compareRenting({ vrlt, total, rentalMonths, monthlyRent, rentalCosts }) {
  const netIncome = dollars(rentalMonths * monthlyRent - rentalCosts);
  const vrltAvoided = rentalMonths >= 6 ? vrlt : 0;
  return {
    netIncome,
    vrltAvoided,
    rentalTax: dollars(total - vrltAvoided),
    cashSwing: dollars(netIncome + vrltAvoided),
  };
}
