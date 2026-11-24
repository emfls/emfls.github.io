const HOUSEHOLDS = {
  single: { limit: 105048, deemingBand: 66800 },
  couple: { limit: 168076, deemingBand: 110600 },
  separated: { limit: 210096, deemingBand: 110600 }
}

// Keep comparisons exact by working in integer cents times basis points.
const BASIS_POINTS = 10000
const TICKS_PER_DOLLAR = 100 * BASIS_POINTS
const LOWER_RATE = 175
const UPPER_RATE = 375
const RATE_INCREASE = 50
const CHILD_ALLOWANCE_CENTS = 63960

function bounded(value, max, name) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(`${name} must be between 0 and ${max}.`)
  }
}

function cents(value, name) {
  bounded(value, 1_000_000_000, name)
  const amount = Math.round(value * 100)
  if (amount / 100 !== value) throw new RangeError(`${name} must use whole cents.`)
  return amount
}

function count(value, name) {
  bounded(value, 9999, name)
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be a whole number.`)
  return value
}

export function calculateCSHC({
  household = 'single',
  dependentChildren = 0,
  taxableIncome = 0,
  targetForeignIncome = 0,
  totalNetInvestmentLosses = 0,
  reportableFringeBenefits = 0,
  reportableEmployerSuper = 0,
  pensionBalance = 0,
  grandfathered = false,
  partnerBalance = 0,
  partnerGrandfathered = false,
  partnerUnder60 = false
} = {}) {
  if (!Object.hasOwn(HOUSEHOLDS, household)) throw new RangeError('Choose a household type.')
  for (const value of [grandfathered, partnerGrandfathered, partnerUnder60]) {
    if (typeof value !== 'boolean') throw new RangeError('Pension exclusions must be true or false.')
  }

  const { limit, deemingBand } = HOUSEHOLDS[household]
  const childAllowance = count(dependentChildren, 'Dependent children') * CHILD_ALLOWANCE_CENTS
  const limitCents = limit * 100 + childAllowance
  const atiCents = cents(taxableIncome, 'Taxable income')
    + cents(targetForeignIncome, 'Target foreign income')
    + cents(totalNetInvestmentLosses, 'Total net investment losses')
    + cents(reportableFringeBenefits, 'Assessable fringe benefits')
    + cents(reportableEmployerSuper, 'Reportable super contributions')
  const ownCents = cents(pensionBalance, 'Your pension balance')
  const partnerCents = cents(partnerBalance, 'Partner pension balance')
  const balanceCents = (grandfathered ? 0 : ownCents)
    + (household === 'single' || partnerGrandfathered || partnerUnder60 ? 0 : partnerCents)

  const bandCents = deemingBand * 100
  const deemedTicks = Math.min(balanceCents, bandCents) * LOWER_RATE
    + Math.max(0, balanceCents - bandCents) * UPPER_RATE
  const totalTicks = atiCents * BASIS_POINTS + deemedTicks
  const marginTicks = limitCents * BASIS_POINTS - totalTicks
  let extraCents = 0
  if (marginTicks > 0) {
    // Subtract one tick so the inverse still passes the strict income cutoff.
    const availableTicks = (limitCents - atiCents) * BASIS_POINTS - 1
    const lowerBandTicks = bandCents * LOWER_RATE
    const maximumBalanceCents = availableTicks <= lowerBandTicks
      ? Math.floor(availableTicks / LOWER_RATE)
      : bandCents + Math.floor((availableTicks - lowerBandTicks) / UPPER_RATE)
    extraCents = maximumBalanceCents - balanceCents
  }

  return {
    status: marginTicks > 0 ? 'ELIGIBLE' : 'OVER_THRESHOLD',
    incomeLimit: limitCents / 100,
    incomeMargin: marginTicks / TICKS_PER_DOLLAR,
    adjustedTaxableIncome: atiCents / 100,
    assessableBalance: balanceCents / 100,
    deemedIncome: deemedTicks / TICKS_PER_DOLLAR,
    totalCSHCIncome: totalTicks / TICKS_PER_DOLLAR,
    additionalDeemedIncome: balanceCents * RATE_INCREASE / TICKS_PER_DOLLAR,
    maximumExtraBalance: extraCents / 100
  }
}

export function estimateHealthcare({
  prescriptions = 0,
  generalCopay = 25,
  concessionCopay = 7.70,
  newlyBulkBilledVisits = 0,
  gpGap = 0
} = {}) {
  const general = cents(generalCopay, 'General PBS cost')
  const concession = cents(concessionCopay, 'Concession PBS cost')
  const pbs = count(prescriptions, 'PBS prescriptions') * Math.max(0, general - concession)
  const gp = count(newlyBulkBilledVisits, 'Newly bulk-billed visits') * cents(gpGap, 'GP gap')
  return { pbsSavings: pbs / 100, gpSavings: gp / 100, total: (pbs + gp) / 100 }
}
