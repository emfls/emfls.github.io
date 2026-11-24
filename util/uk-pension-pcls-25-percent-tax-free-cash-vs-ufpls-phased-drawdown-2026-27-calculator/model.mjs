export const RULES = Object.freeze({
  lsa: 268275,
  annualAllowance: 60000,
  mpaa: 10000,
  personalAllowance: 12570,
  basicCap: 50270,
  basicBand: 37700,
  allowanceTaperStart: 100000,
  additionalThreshold: 125140,
  maxInput: 1000000000,
})

export const DEFAULTS = Object.freeze({
  pot: 400000,
  usedLsa: 0,
  otherIncome: 22000,
  annualTarget: 40000,
  growth: 4,
  years: 10,
  priorMpaa: false,
  statePensionOnly: false,
})

const cents = pounds => Math.round(pounds * 100)
const pounds = pennies => pennies / 100
const positive = value => Math.max(0, value)
const quarter = pennies => Math.floor(pennies / 4)

function inRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min.toLocaleString('en-GB')} and ${max.toLocaleString('en-GB')}.`)
  }
}

function taxInCents(income) {
  const allowance = positive(cents(RULES.personalAllowance) - positive(income - cents(RULES.allowanceTaperStart)) / 2)
  const taxable = positive(income - allowance)
  const basic = cents(RULES.basicBand)
  const higher = cents(RULES.additionalThreshold)
  return Math.round(
    Math.min(taxable, basic) * 0.20 +
    positive(Math.min(taxable, higher) - basic) * 0.40 +
    positive(taxable - higher) * 0.45
  )
}

// Annual non-savings income tax for England, Wales and Northern Ireland.
export function annualTax(income) {
  inRange(income, 0, Number.MAX_SAFE_INTEGER / 100, 'Income')
  return pounds(taxInCents(cents(income)))
}

function monthOneInCents(payment) {
  // HMRC manual Tables A and B–D. 1257L uses code 257 (£214.92)
  // plus two £416.67 adjustments. The taxable remainder is rounded down to pounds.
  const taxable = Math.floor(positive(payment - 104826) / 100)
  if (taxable <= 3142) return taxable * 20
  if (taxable <= 10429) return 62846 + (taxable - 3142) * 40
  return 354330 + (taxable - 10429) * 45
}

export function monthOneTax(payment) {
  inRange(payment, 0, Number.MAX_SAFE_INTEGER / 100, 'Taxable payment')
  return pounds(monthOneInCents(cents(payment)))
}

function simulate(strategy, settings) {
  const { pot, usedLsa, otherIncome, annualTarget, growth, years, priorMpaa } = settings
  const lsaLimit = cents(RULES.lsa)
  const baselineTax = taxInCents(otherIncome)
  const headroom = positive(cents(RULES.basicCap) - otherIncome)
  const growthFactor = 1 + growth / 100
  let uncrystallised = pot
  let drawdown = 0
  let lsaLeft = lsaLimit - usedLsa
  let triggerYear = null
  let cumulativeNet = 0
  let totalTax = 0
  const rows = []

  for (let year = 1; year <= years; year++) {
    let taxFree = 0
    let taxable = 0
    if (strategy === 'upfront' && year === 1) {
      taxFree = Math.min(quarter(uncrystallised), lsaLeft)
      drawdown = uncrystallised - taxFree
      uncrystallised = 0
    } else if (strategy === 'phased') {
      const normalCash = quarter(Math.min(annualTarget, uncrystallised))
      taxFree = Math.min(quarter(uncrystallised), lsaLeft, Math.max(normalCash, annualTarget - headroom))
      taxable = Math.min(headroom, annualTarget - taxFree, uncrystallised + drawdown - taxFree)
      // Designate enough to cover the PCLS and any taxable cash beyond the existing drawdown fund.
      const designated = Math.max(taxFree * 4, taxFree + positive(taxable - drawdown))
      uncrystallised -= designated
      drawdown += designated - taxFree - taxable
    } else if (strategy === 'ufpls') {
      const slice = Math.min(annualTarget, uncrystallised)
      taxFree = Math.min(quarter(slice), lsaLeft)
      taxable = slice - taxFree
      uncrystallised -= slice
    }

    if (!priorMpaa && triggerYear === null && taxable > 0) triggerYear = year
    lsaLeft -= taxFree
    const combinedTax = taxInCents(otherIncome + taxable)
    const tax = combinedTax - baselineTax
    const gross = taxFree + taxable
    const net = gross - tax
    cumulativeNet += net
    totalTax += tax
    const grownBalance = Math.round((uncrystallised + drawdown) * growthFactor)
    uncrystallised = Math.round(uncrystallised * growthFactor)
    drawdown = grownBalance - uncrystallised

    rows.push({
      year,
      taxFree: pounds(taxFree),
      taxable: pounds(taxable),
      gross: pounds(gross),
      tax: pounds(tax),
      totalTax: pounds(combinedTax),
      net: pounds(net),
      cumulativeNet: pounds(cumulativeNet),
      uncrystallised: pounds(uncrystallised),
      drawdown: pounds(drawdown),
    })
  }

  return {
    rows,
    status: priorMpaa || triggerYear !== null ? 'TRIGGERED_10K_MPAA' : 'SAFE_60K',
    triggerYear,
    net: pounds(cumulativeNet),
    netAtTen: rows[9]?.cumulativeNet ?? null,
    tax: pounds(totalTax),
    taxFree: pounds(lsaLimit - usedLsa - lsaLeft),
    lsaUsedPercent: (lsaLimit - lsaLeft) / lsaLimit * 100,
    remaining: pounds(uncrystallised + drawdown),
    remainingTaxFree: pounds(Math.min(quarter(uncrystallised), lsaLeft)),
  }
}

export function compare(input = DEFAULTS) {
  inRange(input.pot, 0, RULES.maxInput, 'Uncrystallised pension pot')
  inRange(input.usedLsa, 0, RULES.lsa, 'LSA already used')
  inRange(input.otherIncome, 0, RULES.maxInput, 'Other annual income')
  inRange(input.annualTarget, 0, RULES.maxInput, 'Annual gross withdrawal target')
  inRange(input.growth, -100, 100, 'Annual growth')
  inRange(input.years, 1, 15, 'Projection years')
  if (!Number.isInteger(input.years)) throw new RangeError('Projection years must be a whole number.')
  if (typeof input.priorMpaa !== 'boolean' || typeof input.statePensionOnly !== 'boolean') {
    throw new RangeError('Select a valid MPAA history and income type.')
  }

  const settings = {
    ...input,
    pot: cents(input.pot),
    usedLsa: cents(input.usedLsa),
    otherIncome: cents(input.otherIncome),
    annualTarget: cents(input.annualTarget),
  }
  const lsaLeft = cents(RULES.lsa) - settings.usedLsa
  const maxTaxFree = Math.min(quarter(settings.pot), lsaLeft)
  const strategies = {
    upfront: simulate('upfront', settings),
    phased: simulate('phased', settings),
    ufpls: simulate('ufpls', settings),
  }
  const first = strategies.ufpls.rows[0]
  let emergency = null
  if (first.gross > 0) {
    const withheld = monthOneInCents(cents(first.taxable))
    const trueTax = cents(first.tax)
    const refund = positive(withheld - trueTax)
    let route = null
    if (refund > 0) {
      // Use the pre-growth pot to determine whether the payment extinguished the fund.
      if (cents(first.gross) < settings.pot) route = 'P55'
      else route = input.statePensionOnly || settings.otherIncome === 0 ? 'P50Z' : 'P53Z'
    }

    emergency = {
      gross: first.gross,
      taxable: first.taxable,
      withheld: pounds(withheld),
      trueTax: first.tax,
      refund: pounds(refund),
      additionalTax: pounds(positive(trueTax - withheld)),
      takeHome: pounds(cents(first.gross) - withheld),
      route,
    }
  }

  return {
    strategies,
    emergency,
    maxTaxFree: pounds(maxTaxFree),
    lsaLeft: pounds(lsaLeft),
    lsaUsedAfterMaxPercent: (cents(RULES.lsa) - lsaLeft + maxTaxFree) / cents(RULES.lsa) * 100,
    basicHeadroom: pounds(positive(cents(RULES.basicCap) - settings.otherIncome)),
    zeroTaxHeadroom: pounds(positive(cents(RULES.personalAllowance) - settings.otherIncome)),
  }
}
