// Amounts are CAD. The comparison covers the base credits and Line 45200.
export const FEDERAL = Object.freeze({
  thresholdRate: 0.03,
  thresholdCap: 2890,
  creditRate: 0.14,
  supplementRate: 0.25,
  supplementMax: 1534,
  minimumWorkingIncome: 4478,
  phaseoutStart: 33960,
  phaseoutRate: 0.05,
})

const region = (name, rate, cap) => Object.freeze({ name, rate, cap })
export const PROVINCES = Object.freeze({
  AB: region('Alberta', 0.08, 2942),
  BC: region('British Columbia', 0.056, 2748),
  MB: region('Manitoba', 0.108, 1728),
  NB: region('New Brunswick', 0.094, 2854),
  NL: region('Newfoundland and Labrador', 0.087, 2437),
  NS: region('Nova Scotia', 0.0879, 1637),
  NT: region('Northwest Territories', 0.059, 2890),
  NU: region('Nunavut', 0.04, 2890),
  ON: region('Ontario', 0.0505, 2940),
  PE: region('Prince Edward Island', 0.095, 1678),
  QC: region('Québec', 0.20, Infinity),
  SK: region('Saskatchewan', 0.105, 2735),
  YT: region('Yukon', 0.064, 2890),
})

const MAX_AMOUNT = 1_000_000_000

function amount(value, name, allowNegative = false) {
  if (!Number.isFinite(value) || value < (allowNegative ? -MAX_AMOUNT : 0) || value > MAX_AMOUNT) {
    throw new RangeError(`Enter a valid amount for ${name}.`)
  }
  return value
}

function claimant(input, name) {
  if (typeof input.supplementEligible !== 'boolean') {
    throw new RangeError(`Specify supplement eligibility for ${name}.`)
  }
  return {
    netIncome: amount(input.netIncome, `${name} net income`, true),
    workingIncome: amount(input.workingIncome, `${name} working income`),
    federalTax: amount(input.federalTax, `${name} federal tax`),
    localTax: amount(input.localTax, `${name} local tax`),
    disabilitySupports: amount(input.disabilitySupports ?? 0, `${name} disability supports`),
    supplementEligible: input.supplementEligible,
  }
}

const toCents = (value) => Math.round(value * 100 + 1e-7)
const dollars = (cents) => cents / 100
const threshold = (income, cap) => Math.min(cap, FEDERAL.thresholdRate * Math.max(0, income))

function scenario(person, expenses, local, familyIncome) {
  const fedThreshold = threshold(person.netIncome, FEDERAL.thresholdCap)
  const fedEligible = Math.max(0, expenses - fedThreshold)
  const fedCredit = fedEligible * FEDERAL.creditRate
  const localThreshold = threshold(local.familyIncome ?? person.netIncome, local.cap)
  const localCredit = Math.max(0, local.expenses - localThreshold) * local.rate

  // Québec's 16.5% abatement shrinks when an additional credit reduces basic federal tax.
  const fedUsable = toCents(Math.min(person.federalTax, fedCredit) * local.federalFactor)
  const localUsable = toCents(Math.min(person.localTax, localCredit))
  const supplementBase = Math.min(FEDERAL.supplementMax,
    (fedEligible + person.disabilitySupports) * FEDERAL.supplementRate)
  const phaseout = Math.max(0, familyIncome - FEDERAL.phaseoutStart) * FEDERAL.phaseoutRate
  const refundable = person.supplementEligible && person.workingIncome >= FEDERAL.minimumWorkingIncome
    ? toCents(Math.max(0, supplementBase - phaseout))
    : 0

  return {
    fedThreshold: dollars(toCents(fedThreshold)),
    fedEligible: dollars(toCents(fedEligible)),
    fedCredit: dollars(toCents(fedCredit)),
    fedUsable: dollars(fedUsable),
    localThreshold: dollars(toCents(localThreshold)),
    localCredit: dollars(toCents(localCredit)),
    localUsable: dollars(localUsable),
    refundable: dollars(refundable),
    total: dollars(fedUsable + localUsable + refundable),
  }
}

/** Compare two scenarios in which the same spouse claims the pooled expenses at both levels. */
export function calculateMETC(input) {
  if (!Object.hasOwn(PROVINCES, input.province)) throw new RangeError('Select a province or territory.')

  const spouseA = claimant(input.spouseA, 'Spouse A')
  const spouseB = claimant(input.spouseB, 'Spouse B')
  const expenses = amount(input.expenses, 'eligible medical expenses')
  const combinedIncome = spouseA.netIncome + spouseB.netIncome
  const familyIncome = input.adjustedFamilyIncome == null
    ? combinedIncome
    : amount(input.adjustedFamilyIncome, 'adjusted family net income', true)
  const local = { ...PROVINCES[input.province], expenses, federalFactor: 1 }
  if (input.province === 'QC') {
    local.familyIncome = input.quebecFamilyIncome == null
      ? combinedIncome
      : amount(input.quebecFamilyIncome, 'combined Québec net income', true)
    local.expenses = amount(input.quebecExpenses ?? expenses, 'eligible Québec expenses')
    local.federalFactor = 0.835
  }

  const a = scenario(spouseA, expenses, local, familyIncome)
  const b = scenario(spouseB, expenses, local, familyIncome)
  const difference = toCents(a.total) - toCents(b.total)
  const winner = difference === 0 ? 'tie' : difference > 0 ? 'A' : 'B'
  return { a, b, winner, extraSavings: dollars(Math.abs(difference)) }
}
