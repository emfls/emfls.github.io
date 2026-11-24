const YEARLY_CAR_TIER = 10_000
const P87_LIMIT_PENCE = 250_000
const PASSENGER_RATE = 5
const VEHICLE_RATES = new Map([['motorcycle', 24], ['bicycle', 20]])
const TAX_RATES = [0, 19, 20, 21, 40, 42, 45, 48]

function checkNumber(value, label, min = 0, max = 1_000_000) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`)
  }
}

// Round amounts once at the penny boundary, allowing for binary floating-point error.
function roundPence(pence) {
  return Math.round(pence + Number.EPSILON * pence)
}

function firstTierRate(vehicle, year) {
  if (year !== 'current' && year !== 'legacy') throw new RangeError('Choose a mileage tax year.')
  if (vehicle === 'car') return year === 'current' ? 55 : 45
  if (!VEHICLE_RATES.has(vehicle)) throw new RangeError('Choose a supported vehicle.')
  return VEHICLE_RATES.get(vehicle)
}

function allowancePence(vehicle, year, miles) {
  const rate = firstTierRate(vehicle, year)
  if (vehicle !== 'car') return roundPence(miles * rate)

  const firstMiles = Math.min(miles, YEARLY_CAR_TIER)
  return roundPence(firstMiles * rate + (miles - firstMiles) * 25)
}

export function calculateMileage({
  vehicle, year = 'current', miles, reimbursement, taxRate,
  passengerMiles = 0, passengerPaid = 0, otherExpenses = 0, selfAssessment = false,
}) {
  checkNumber(miles, 'Business miles')
  checkNumber(reimbursement, 'Mileage reimbursement')
  checkNumber(passengerMiles, 'Passenger-miles')
  checkNumber(passengerPaid, 'Passenger payments')
  checkNumber(otherExpenses, 'Other allowable expenses')
  if (!TAX_RATES.includes(taxRate)) throw new RangeError('Choose a marginal Income Tax band.')
  if (vehicle !== 'car' && (passengerMiles > 0 || passengerPaid > 0)) {
    throw new RangeError('The passenger supplement applies to cars and vans.')
  }
  if (miles === 0 && passengerMiles > 0) throw new RangeError('Enter business miles for the passenger journeys.')

  const approved = allowancePence(vehicle, year, miles)
  const current = allowancePence(vehicle, 'current', miles)
  const legacy = allowancePence(vehicle, 'legacy', miles)
  const paid = roundPence(reimbursement * 100)
  const deduction = Math.max(0, approved - paid)
  const totalClaim = deduction + roundPence(otherExpenses * 100)
  let filingRoute = null
  if (deduction > 0 && taxRate > 0) {
    filingRoute = selfAssessment || totalClaim > P87_LIMIT_PENCE ? 'Self Assessment' : 'P87'
  }

  const passengerAllowance = roundPence(passengerMiles * PASSENGER_RATE)
  const passengerPayment = roundPence(passengerPaid * 100)

  return {
    allowance: approved / 100,
    allowanceIncrease: (current - legacy) / 100,
    deduction: deduction / 100,
    taxRelief: roundPence(deduction * taxRate / 100) / 100,
    incomeTaxExcess: Math.max(0, paid - approved) / 100,
    filingRoute,
    totalClaim: totalClaim / 100,
    passengerAllowance: passengerAllowance / 100,
    taxFreePassengerPayment: Math.min(passengerAllowance, passengerPayment) / 100,
    passengerTaxExcess: Math.max(0, passengerPayment - passengerAllowance) / 100,
  }
}

export function calculatePayrollExcess({ vehicle, year = 'current', miles, motoringPayments }) {
  checkNumber(miles, 'Earnings-period business miles')
  checkNumber(motoringPayments, 'Earnings-period motoring payments')

  const qualifying = roundPence(miles * firstTierRate(vehicle, year))
  return {
    qualifyingAmount: qualifying / 100,
    payrollExcess: Math.max(0, roundPence(motoringPayments * 100) - qualifying) / 100,
  }
}

export function calculateElectric({
  homeMiles, publicMiles, homeTariff, publicTariff, efficiency, homeRate = 7, publicRate = 15,
}) {
  checkNumber(homeMiles, 'Home-charged miles')
  checkNumber(publicMiles, 'Public-charged miles')
  checkNumber(homeTariff, 'Home electricity price', 0, 1000)
  checkNumber(publicTariff, 'Public electricity price', 0, 1000)
  checkNumber(efficiency, 'EV efficiency', 0.01, 100)
  if (![7, 8].includes(homeRate) || ![14, 15].includes(publicRate)) {
    throw new RangeError('Choose a supported home and public advisory rate.')
  }

  const homeCostPerMile = homeTariff / efficiency
  const publicCostPerMile = publicTariff / efficiency
  const homeCost = roundPence(homeMiles * homeCostPerMile)
  const publicCost = roundPence(publicMiles * publicCostPerMile)
  const homeReimbursement = roundPence(homeMiles * homeRate)
  const publicReimbursement = roundPence(publicMiles * publicRate)
  const reimbursement = homeReimbursement + publicReimbursement
  const actualCost = homeCost + publicCost

  return {
    homeCostPerMile,
    publicCostPerMile,
    homeReimbursement: homeReimbursement / 100,
    publicReimbursement: publicReimbursement / 100,
    reimbursement: reimbursement / 100,
    actualCost: actualCost / 100,
    publicShortfall: Math.max(0, publicCost - publicReimbursement) / 100,
    netShortfall: Math.max(0, actualCost - reimbursement) / 100,
  }
}
