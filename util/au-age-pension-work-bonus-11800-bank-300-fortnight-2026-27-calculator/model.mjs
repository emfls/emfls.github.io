export const FORTNIGHTS = 26
export const WORK_BONUS = Object.freeze({ credit: 300, cap: 11800, newClaim: 4000 })

export const DEFAULT_RULES = Object.freeze({
  single: Object.freeze({ freeArea: 226, maxPension: 1237.70 }),
  couple: Object.freeze({ freeArea: 396, maxPension: 1866 }),
  'couple-one': Object.freeze({ freeArea: 396, maxPension: 933 }),
})

export const BRIEF_RULES = Object.freeze({
  single: Object.freeze({ freeArea: 218, maxPension: 1178.70 }),
  couple: Object.freeze({ freeArea: 380, maxPension: 1777 }),
  'couple-one': Object.freeze({ freeArea: 380, maxPension: 888.50 }),
})

const MAX_MONEY = 100000000
const dollars = cents => cents / 100
const credit = WORK_BONUS.credit * 100
const cap = WORK_BONUS.cap * 100

function moneyToCents(amount, label, max = MAX_MONEY) {
  const cents = Math.round(amount * 100)
  if (!Number.isFinite(amount) || amount < 0 || amount > max || Math.abs(amount * 100 - cents) > 0.00001) {
    throw new RangeError(`${label} must be between $0 and $${max.toLocaleString('en-AU')} with up to two decimal places.`)
  }
  return cents
}

function offsetWork(gross, openingBalance, eligible) {
  const currentOffset = eligible ? Math.min(credit, gross) : 0
  const drawn = eligible ? Math.min(openingBalance, gross - currentOffset) : 0
  const accrued = eligible ? Math.min(cap - openingBalance, credit - currentOffset) : 0
  return {
    gross, currentOffset, drawn, accrued,
    balance: openingBalance - drawn + accrued,
    assessable: gross - currentOffset - drawn,
  }
}

function inDollars(amounts) {
  return Object.fromEntries(Object.entries(amounts).map(([key, value]) => [key, dollars(value)]))
}

export function applyWorkBonus(gross, balance, eligible = true) {
  return inDollars(offsetWork(
    moneyToCents(gross, 'Work income'),
    moneyToCents(balance, 'Work Bonus balance', WORK_BONUS.cap),
    eligible,
  ))
}

export function schedule(pay, start = 1, duration = FORTNIGHTS) {
  moneyToCents(pay, 'Work income')
  if (!Number.isInteger(start) || !Number.isInteger(duration) ||
      start < 1 || duration < 1 || start + duration - 1 > FORTNIGHTS) {
    throw new RangeError('Enter a whole-number start and length that fit within fortnights 1 to 26.')
  }
  return Array.from({ length: FORTNIGHTS }, (_, index) =>
    index >= start - 1 && index < start - 1 + duration ? pay : 0)
}

export function simulate({ household, people, otherIncome, freeArea, maxPension }) {
  if (!Object.hasOwn(DEFAULT_RULES, household)) throw new RangeError('Select a household type.')
  const single = household === 'single'
  const recipients = household === 'couple' ? 2 : 1
  if (people.length !== (single ? 1 : 2)) throw new RangeError('Enter each household member’s income.')
  const incomeFreeArea = moneyToCents(freeArea ?? DEFAULT_RULES[household].freeArea, 'Income-free area')
  const maximum = moneyToCents(maxPension ?? DEFAULT_RULES[household].maxPension, 'Maximum pension')
  const other = moneyToCents(otherIncome, 'Other assessable income')
  const earnings = people.map(person => {
    if (!Array.isArray(person.earnings) || person.earnings.length !== FORTNIGHTS) {
      throw new RangeError('Enter earnings for 26 fortnights.')
    }
    return Array.from(person.earnings, pay => moneyToCents(pay, 'Work income'))
  })
  const eligible = people.map((person, index) => person.eligible && index < recipients)
  const balances = people.map((person, index) =>
    eligible[index] ? moneyToCents(person.balance, 'Starting balance', WORK_BONUS.cap) : 0)

  // Apply the standard taper for each recipient before rounding the household total.
  const pension = income => {
    const excess = Math.max(0, income - incomeFreeArea)
    const taper = single ? 0.5 : 0.25 * recipients
    return Math.max(0, Math.round(maximum - excess * taper))
  }

  const totals = { gross: 0, withBonus: 0, withoutBonus: 0, saved: 0 }
  const rows = Array.from({ length: FORTNIGHTS }, (_, index) => {
    const offsets = people.map((_, person) => {
      const offset = offsetWork(earnings[person][index], balances[person], eligible[person])
      balances[person] = offset.balance
      return offset
    })
    const sum = key => offsets.reduce((total, offset) => total + offset[key], 0)
    const gross = sum('gross')
    const assessableWork = sum('assessable')
    const assessableTotal = assessableWork + other
    const pensionWith = pension(assessableTotal)
    const pensionWithout = pension(gross + other)
    const saved = pensionWith - pensionWithout
    totals.gross += gross
    totals.withBonus += pensionWith
    totals.withoutBonus += pensionWithout
    totals.saved += saved
    return {
      fortnight: index + 1,
      ...inDollars({
        gross, currentOffset: sum('currentOffset'), drawn: sum('drawn'), accrued: sum('accrued'),
        assessableWork, other, assessableTotal, pensionWith, pensionWithout, saved,
      }),
      people: offsets.map(inDollars),
    }
  })

  return { rows, totals: inDollars(totals), endingBalances: balances.map(dollars) }
}
