export const CLASS_1A_RATE = 15;
export const FUEL_MULTIPLIER = 29_200;

const TAX_YEARS = ['2026/27', '2027/28', '2028/29', '2029/30'];
const EV_RATES = [4, 5, 7, 9];
const MAX_PRICE = 10_000_000;

function requireRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(label + ' must be between ' + min.toLocaleString('en-GB') + ' and ' + max.toLocaleString('en-GB') + '.');
  }
}

function comparatorRates(band, rate) {
  switch (band) {
    case 'standard':
      requireRange(rate, 21, 37, 'The 2026/27 comparator BiK rate');
      if (!Number.isInteger(rate)) throw new RangeError('Enter a whole comparator BiK percentage.');
      return [rate, rate, rate + 1, rate + 2];
    case 'intermediate': {
      requireRange(rate, 17, 21, 'The 2026/27 comparator BiK rate');
      if (!Number.isInteger(rate)) throw new RangeError('Enter a whole comparator BiK percentage.');
      const nextRate = Math.min(rate + 1, 21);
      return [rate, nextRate, nextRate + 1, nextRate + 2];
    }
    case 'phev':
      if (![4, 7, 10, 14, 16].includes(rate)) throw new RangeError('Select a PHEV electric range.');
      return [rate, rate + 1, 18, 19];
    default:
      throw new RangeError('Select a comparator emissions band.');
  }
}

function annualBenefit(listPrice, rate, taxRate, fuelMultiplier) {
  const bikValue = listPrice * rate / 100;
  const fuelBik = fuelMultiplier * rate / 100;
  const employeeTax = (bikValue + fuelBik) * taxRate / 100;
  return {
    rate,
    bikValue,
    fuelBik,
    employeeTax,
    monthlyTax: employeeTax / 12,
    employerNic: (bikValue + fuelBik) * CLASS_1A_RATE / 100,
    fuelEmployeeTax: fuelBik * taxRate / 100,
    fuelEmployerNic: fuelBik * CLASS_1A_RATE / 100,
  };
}

function sumCharge(years, vehicle, key) {
  return years.reduce((total, year) => total + year[vehicle][key], 0);
}

export function calculateComparison({
  evListPrice, comparatorListPrice, taxRate, comparatorBand, comparatorRate, privateFuel,
}) {
  requireRange(evListPrice, 0.01, MAX_PRICE, 'The EV P11D price');
  requireRange(comparatorListPrice, 0.01, MAX_PRICE, 'The comparator P11D price');
  if (![20, 40, 45, 60].includes(taxRate)) throw new RangeError('Select an employee tax rate.');
  if (typeof privateFuel !== 'boolean') throw new RangeError('Select whether private fuel is provided.');

  const rates = comparatorRates(comparatorBand, comparatorRate);
  const years = TAX_YEARS.map((taxYear, index) => ({
    taxYear,
    ev: annualBenefit(evListPrice, EV_RATES[index], taxRate, 0),
    comparator: annualBenefit(comparatorListPrice, rates[index], taxRate, privateFuel ? FUEL_MULTIPLIER : 0),
  }));
  const ev = {
    employeeTax: sumCharge(years, 'ev', 'employeeTax'),
    employerNic: sumCharge(years, 'ev', 'employerNic'),
  };
  const comparator = {
    employeeTax: sumCharge(years, 'comparator', 'employeeTax'),
    employerNic: sumCharge(years, 'comparator', 'employerNic'),
  };
  return {
    years,
    ev,
    comparator,
    fuel: {
      employeeTax: sumCharge(years, 'comparator', 'fuelEmployeeTax'),
      employerNic: sumCharge(years, 'comparator', 'fuelEmployerNic'),
    },
    employeeSavings: comparator.employeeTax - ev.employeeTax,
    employerSavings: comparator.employerNic - ev.employerNic,
    escalationTax: years.at(-1).ev.employeeTax - years[0].ev.employeeTax,
    escalationPercent: (EV_RATES.at(-1) / EV_RATES[0] - 1) * 100,
  };
}

export function calculatePurchase({
  companyPurchasePrice, personalPurchasePrice, corporationTaxRate, qualifyingPurchase,
  employeeTax, employerNic,
}) {
  requireRange(companyPurchasePrice, 0.01, MAX_PRICE, 'The company purchase price');
  requireRange(personalPurchasePrice, 0.01, MAX_PRICE, 'The personal purchase price');
  requireRange(corporationTaxRate, 19, 25, 'The modelled Corporation Tax rate');
  requireRange(employeeTax, 0, MAX_PRICE, 'The four-year director tax');
  requireRange(employerNic, 0, MAX_PRICE, 'The four-year employer NIC');
  if (typeof qualifyingPurchase !== 'boolean') throw new RangeError('Select whether the purchase qualifies.');

  const deductibleAmount = qualifyingPurchase ? companyPurchasePrice : 0;
  const corporationTaxSaved = deductibleAmount * corporationTaxRate / 100;
  const companyNetPurchase = companyPurchasePrice - corporationTaxSaved;
  const combinedCost = companyNetPurchase + employeeTax + employerNic;
  return {
    deductibleAmount, corporationTaxSaved, companyNetPurchase, combinedCost,
    personalCost: personalPurchasePrice,
    combinedSavings: personalPurchasePrice - combinedCost,
  };
}
