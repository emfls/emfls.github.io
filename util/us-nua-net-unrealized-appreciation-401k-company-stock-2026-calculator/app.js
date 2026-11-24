import { calculateNua } from './model.mjs'

const form = document.querySelector('#nua-form')
const results = document.querySelector('#results')
const error = document.querySelector('#input-error')
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 })
const outputs = [...results.querySelectorAll('[data-money]')]

function basisVerdict(ratio) {
  if (ratio === null) return 'Enter a stock value to compare the basis.'
  if (ratio >= 1) return 'No built-in appreciation at distribution.'
  if (ratio <= 0.25) return 'Low basis favors the NUA tax split.'
  if (ratio >= 0.50) return 'High basis increases the upfront tax burden.'
  return 'At this basis, rates and timing can decide the outcome.'
}

function render() {
  const invalid = [...form.elements].find((field) => field.willValidate && !field.validity.valid)
  if (invalid) {
    error.textContent = `${invalid.labels[0].textContent}: ${invalid.validationMessage}`
    error.hidden = false
    results.hidden = true
    return
  }

  const inputs = Object.fromEntries([...form.elements].map((field) => [
    field.name,
    field.type === 'checkbox' ? field.checked : Number(field.value),
  ]))
  const comparison = calculateNua(inputs)
  const { basisRatio, wealthDifference, postGainRate } = comparison

  for (const output of outputs) {
    const amount = comparison[output.dataset.money]
    output.textContent = money.format(Math.abs(amount) < 0.005 ? 0 : amount)
  }

  document.querySelector('#basis-ratio').textContent = basisRatio === null ? 'N/A' : percent.format(basisRatio)
  document.querySelector('#basis-verdict').textContent = basisVerdict(basisRatio)
  const advantage = Math.abs(wealthDifference)
  document.querySelector('#outcome').textContent = advantage < 0.005
    ? 'Both paths project the same after-tax wealth.'
    : `${wealthDifference > 0 ? 'NUA' : 'The IRA rollover'} projects ${money.format(advantage)} more after tax.`
  document.querySelector('#post-rate').textContent =
    `${inputs.years > 1 ? 'Long-term' : 'Short-term'} at ${percent.format(postGainRate)}, before NIIT`
  error.hidden = true
  results.hidden = false
}

form.addEventListener('input', render)
form.addEventListener('submit', (event) => {
  event.preventDefault()
  render()
})
render()
