import { BRIEF_RULES, DEFAULT_RULES, FORTNIGHTS, schedule, simulate } from './model.mjs'

const byId = id => document.getElementById(id)
const form = byId('calculator')
const householdInput = byId('household')
const patternInput = byId('pattern')
const basisInput = byId('basis')
const freeAreaInput = byId('free-area')
const maximumInput = byId('maximum')
const tracker = byId('tracker-body')
const error = byId('error')
const totals = [
  ['saved', byId('saved')],
  ['withBonus', byId('with-bonus')],
  ['withoutBonus', byId('without-bonus')],
]

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
const decimal = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function loadBenchmarks() {
  const rules = basisInput.value === 'comparison' ? BRIEF_RULES : DEFAULT_RULES
  const { freeArea, maxPension } = rules[householdInput.value]
  freeAreaInput.value = freeArea.toFixed(2)
  maximumInput.value = maxPension.toFixed(2)
}

function toggleFields(id, active) {
  const fieldset = byId(id)
  fieldset.hidden = !active
  fieldset.disabled = !active
}

function readNumber(id) {
  const input = byId(id)
  if (!input.validity.valid) {
    throw new RangeError(`${input.labels[0].textContent}: ${input.validationMessage}`)
  }
  return input.valueAsNumber
}

function renderTable(rows, partnerBankActive) {
  const fragment = document.createDocumentFragment()
  for (const row of rows) {
    const tr = document.createElement('tr')
    const fortnight = document.createElement('th')
    fortnight.scope = 'row'
    fortnight.textContent = row.fortnight
    tr.append(fortnight)
    const amounts = [
      row.gross, row.currentOffset, row.drawn, row.accrued, row.people[0].balance,
      ...(partnerBankActive ? [row.people[1].balance] : []),
      row.assessableWork, row.other, row.assessableTotal, row.pensionWith, row.pensionWithout, row.saved,
    ]
    for (const amount of amounts) {
      const td = document.createElement('td')
      td.textContent = decimal.format(amount)
      tr.append(td)
    }
    fragment.append(tr)
  }
  tracker.replaceChildren(fragment)
}

function update() {
  const household = householdInput.value
  const hasPartner = household !== 'single'
  const partnerBankActive = household === 'couple'
  const seasonal = patternInput.value === 'seasonal'
  toggleFields('season', seasonal)
  toggleFields('partner', hasPartner)
  byId('partner-bank').hidden = !partnerBankActive
  byId('partner-balance').disabled = !partnerBankActive
  byId('partner-col').hidden = !partnerBankActive
  byId('maximum-label').textContent = partnerBankActive
    ? 'Maximum combined pension per fortnight (A$)'
    : 'Maximum pension per fortnight (A$)'

  let result
  try {
    const start = seasonal ? readNumber('start') : 1
    const length = seasonal ? readNumber('duration') : FORTNIGHTS
    const people = [{
      earnings: schedule(readNumber('work'), start, length),
      balance: readNumber('balance'),
      eligible: true,
    }]
    if (hasPartner) {
      people.push({
        earnings: schedule(readNumber('partner-work'), start, length),
        balance: partnerBankActive ? readNumber('partner-balance') : 0,
        eligible: partnerBankActive,
      })
    }
    result = simulate({
      household,
      people,
      otherIncome: readNumber('other'),
      freeArea: readNumber('free-area'),
      maxPension: readNumber('maximum'),
    })
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem
    error.textContent = problem.message
    error.hidden = false
    for (const [, output] of totals) output.textContent = '—'
    byId('balance-summary').textContent = ''
    byId('result-basis').textContent = ''
    tracker.replaceChildren()
    return
  }

  error.hidden = true
  error.textContent = ''
  for (const [key, output] of totals) output.textContent = currency.format(result.totals[key])
  const [yourBank, partnerBank] = result.endingBalances
  byId('balance-summary').textContent = partnerBankActive
    ? `Closing Work Bonus balances: yours ${currency.format(yourBank)} · partner’s ${currency.format(partnerBank)}.`
    : `Your closing Work Bonus balance: ${currency.format(yourBank)}.`
  byId('result-basis').textContent = `Gross work income: ${currency.format(result.totals.gross)} · ${basisInput.selectedOptions[0].textContent}.`
  renderTable(result.rows, partnerBankActive)
}

form.addEventListener('input', event => {
  const input = event.target
  if (input === freeAreaInput || input === maximumInput) {
    basisInput.value = 'custom'
  } else if (input === householdInput || input === basisInput) {
    if (basisInput.value === 'custom') basisInput.value = 'published'
    loadBenchmarks()
  }
  update()
})

form.addEventListener('submit', event => event.preventDefault())
update()
