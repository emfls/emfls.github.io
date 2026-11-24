import { calculateMETC, PROVINCES } from './model.mjs'

const form = document.querySelector('#metc-form')
const fields = form.elements
const results = document.querySelector('#results')
const summary = document.querySelector('#summary')
const error = document.querySelector('#input-error')
const quebec = document.querySelector('#quebec-fields')
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' })

function optionalAmount(name) {
  return fields[name].value === '' ? undefined : fields[name].valueAsNumber
}

function readSpouse(prefix) {
  return {
    netIncome: fields[`${prefix}-net`].valueAsNumber,
    workingIncome: fields[`${prefix}-work`].valueAsNumber,
    federalTax: fields[`${prefix}-federal`].valueAsNumber,
    localTax: fields[`${prefix}-local`].valueAsNumber,
    supplementEligible: fields[`${prefix}-eligible`].checked,
    disabilitySupports: optionalAmount(`${prefix}-disability`),
  }
}

function update() {
  const province = fields.province.value
  quebec.hidden = province !== 'QC'
  quebec.disabled = quebec.hidden

  const invalid = Array.from(fields).filter((field) => field.willValidate && !field.validity.valid)
  for (const field of form.querySelectorAll('input[type="number"]')) {
    if (invalid.includes(field)) field.setAttribute('aria-invalid', 'true')
    else field.removeAttribute('aria-invalid')
  }
  if (invalid.length) {
    const first = invalid[0]
    error.textContent = `${first.labels[0].textContent} — ${first.validationMessage}`
    error.hidden = false
    results.hidden = true
    summary.textContent = ''
    return
  }

  const estimate = calculateMETC({
    province,
    expenses: fields.expenses.valueAsNumber,
    spouseA: readSpouse('a'),
    spouseB: readSpouse('b'),
    adjustedFamilyIncome: optionalAmount('adjusted-income'),
    quebecFamilyIncome: optionalAmount('qc-income'),
    quebecExpenses: optionalAmount('qc-expenses'),
  })

  error.hidden = true
  error.textContent = ''
  results.hidden = false
  document.querySelector('#local-rate').textContent =
    `${PROVINCES[province].name} · ${(PROVINCES[province].rate * 100).toFixed(2)}% base credit rate`
  document.querySelector('#qc-abatement').hidden = province !== 'QC'
  const message = estimate.winner === 'tie'
    ? `Both scenarios save ${currency.format(estimate.a.total)}.`
    : `Spouse ${estimate.winner} claims all · ${currency.format(estimate.extraSavings)} more in estimated savings.`
  if (summary.textContent !== message) summary.textContent = message

  for (const cell of results.querySelectorAll('[data-scenario]')) {
    const { scenario, metric } = cell.dataset
    cell.textContent = currency.format(estimate[scenario][metric])
  }
}

form.addEventListener('input', update)
form.addEventListener('change', update)
form.addEventListener('submit', (event) => event.preventDefault())
update()
