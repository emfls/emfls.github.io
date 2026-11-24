export const LIMITS = Object.freeze({
  distanceKm: 40,
  mealDollars: 23,
  dailyMealDollars: 69,
  temporaryDays: 15,
  vacantHomeDollars: 5000,
});

// Supplied scenario inputs. Confirm the tax year's CRA schedule before filing.
export const PLANNING_VEHICLE_CENTS = Object.freeze({
  AB: 59.5, BC: 63, MB: 59, NB: 63.5, NL: 65.5, NT: 74.5, NS: 63.5,
  NU: 70, ON: 66, PE: 63, QC: 64.5, SK: 58.5, YT: 74,
});

function scaledNumber(value, field, scale, max, min = 0) {
  const scaled = Math.round(value * scale);
  if (!Number.isFinite(value) || value < min || value > max || scaled / scale !== value) {
    throw new RangeError(`Invalid ${field}`);
  }
  return scaled;
}

export function calculateMovingExpenses(input) {
  const distance = (key) => scaledNumber(input[key], key, 1000, 100000);
  const money = (key) => scaledNumber(input[key] ?? 0, key, 100, 1000000000);
  const count = (key, min = 0) => scaledNumber(input[key] ?? min, key, 1, 100000, min);

  const distanceSaved = (distance('oldHomeToNewWorkKm') - distance('newHomeToNewWorkKm')) / 1000;
  const passesDistance = distanceSaved >= LIMITS.distanceKm;
  const household = count('household', 1);
  const eligibleTemporaryDays = Math.min(count('temporaryDays'), LIMITS.temporaryDays);
  const mealCost = (days, meals) => {
    const dailyMeals = LIMITS.dailyMealDollars / LIMITS.mealDollars;
    return Math.min(count(meals), days * household * dailyMeals) * LIMITS.mealDollars * 100;
  };

  const { province, vehicleMethod = 'simplified', oldHome = 'other' } = input;
  let vehicle;
  if (vehicleMethod === 'actual') {
    vehicle = money('actualVehicle');
  } else if (vehicleMethod === 'simplified') {
    if (!Object.hasOwn(PLANNING_VEHICLE_CENTS, province)) throw new RangeError('Invalid province');
    // Multiply metres by tenths of a cent per kilometre, then round to cents.
    vehicle = Math.round(distance('travelKm') * (PLANNING_VEHICLE_CENTS[province] * 10) / 10000);
  } else {
    throw new RangeError('Invalid vehicleMethod');
  }
  if (!['rented', 'owned', 'sold', 'other'].includes(oldHome)) throw new RangeError('Invalid oldHome');

  const sold = oldHome === 'sold';
  const expenseCents = {
    transport: money('transport'),
    vehicle,
    travelLodging: money('travelLodging'),
    travelMeals: mealCost(count('travelDays'), 'travelMeals'),
    temporaryLodging: eligibleTemporaryDays ? money('temporaryLodging') : 0,
    temporaryMeals: mealCost(eligibleTemporaryDays, 'temporaryMeals'),
    leaseCancellation: oldHome === 'rented' ? money('leaseCancellation') : 0,
    incidentals: money('incidentals'),
    vacantMaintenance: sold || oldHome === 'owned'
      ? Math.min(money('vacantMaintenance'), LIMITS.vacantHomeDollars * 100) : 0,
    selling: sold ? money('selling') : 0,
    buying: sold ? money('buying') : 0,
  };

  const gross = passesDistance ? Object.values(expenseCents).reduce((sum, amount) => sum + amount, 0) : 0;
  const reimbursement = Math.min(gross, money('reimbursement'));
  const net = gross - reimbursement;
  const deduction = Math.min(net, money('newLocationIncome'));
  const rate = scaledNumber(input.marginalRate ?? 0, 'marginalRate', 100, 100);
  return {
    gate: passesDistance ? 'PASS' : 'FAIL',
    distanceSaved,
    eligibleTemporaryDays,
    expenses: Object.fromEntries(Object.entries(expenseCents).map(([key, cents]) => [
      key, passesDistance ? cents / 100 : 0,
    ])),
    grossEligibleExpenses: gross / 100,
    reimbursementApplied: reimbursement / 100,
    totalEligibleExpenses: net / 100,
    deductibleThisYear: deduction / 100,
    carryForward: (net - deduction) / 100,
    estimatedTaxSavings: Math.round(deduction * rate / 10000) / 100,
  };
}
