const multipliers = new Map([
  ['2025_26_28200', 28200],
  ['2026_27_29200', 29200],
  ['2027_28_30200', 30200],
]);

const taxRates = new Set([0, 19, 20, 21, 40, 42, 45, 48]);
const employerNIRate = 0.15;
const litresPerImperialGallon = 4.546;

function requireRange(value, minimum, maximum, label) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum}.`);
  }
}

export function calculateFuelBenefit({
  taxYear, bikPercentage, taxRate, privateMiles, mpg, pumpPrice, monthsProvided, electric = false,
}) {
  const multiplier = multipliers.get(taxYear);
  if (multiplier === undefined) throw new RangeError('Choose a supported tax year.');
  if (typeof electric !== 'boolean') throw new RangeError('Choose a supported vehicle type.');

  if (electric) {
    return {
      multiplier,
      taxableFuelBenefit: 0,
      employeeTax: 0,
      employerNI: 0,
      fuelCostPerMile: null,
      annualPumpCost: null,
      coveredPumpCost: null,
      netEmployeeSavings: null,
      breakEvenAnnualMiles: null,
      breakEvenCoveredMiles: null,
    };
  }

  requireRange(bikPercentage, 2, 37, 'Company car BiK rate');
  if (!taxRates.has(taxRate)) throw new RangeError('Choose a supported marginal income tax rate.');
  requireRange(privateMiles, 0, 200000, 'Annual private mileage');
  requireRange(mpg, 1, 300, 'Fuel economy in UK MPG');
  requireRange(pumpPrice, 1, 1000, 'Pump price in pence per litre');
  requireRange(monthsProvided, 1, 12, 'Months with free fuel');
  if (!Number.isInteger(monthsProvided)) throw new RangeError('Enter a whole number of months.');

  const coveredFraction = monthsProvided / 12;
  const taxableFuelBenefit = multiplier * (bikPercentage / 100) * coveredFraction;
  const employeeTax = taxableFuelBenefit * (taxRate / 100);
  const employerNI = taxableFuelBenefit * employerNIRate;
  const fuelCostPerMile = litresPerImperialGallon * (pumpPrice / 100) / mpg;
  const annualPumpCost = privateMiles * fuelCostPerMile;
  const coveredPumpCost = annualPumpCost * coveredFraction;
  const breakEvenCoveredMiles = employeeTax / fuelCostPerMile;

  return {
    multiplier,
    taxableFuelBenefit,
    employeeTax,
    employerNI,
    fuelCostPerMile,
    annualPumpCost,
    coveredPumpCost,
    netEmployeeSavings: coveredPumpCost - employeeTax,
    breakEvenAnnualMiles: breakEvenCoveredMiles / coveredFraction,
    breakEvenCoveredMiles,
  };
}
