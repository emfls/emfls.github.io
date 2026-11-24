import { calculateTaxShock } from './model.mjs'

const form = document.querySelector('#psi-calculator')
const companySettings = document.querySelector('#company-settings')
const estimate = document.querySelector('#estimate')
const verdict = document.querySelector('#verdict')
const errorBox = document.querySelector('#input-error')
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
const format = amount => amount == null ? 'N/A' : currency.format(amount)
const display = (id, value) => { document.getElementById(id).textContent = value }

const verdictLabels = {
  general: 'General business income · outside PSI',
  psb: 'Personal services business · PSI rules do not apply',
  psi: 'Caught by the personal services income rules',
}

const triggerLabels = {
  'no-income': 'Step 1 · Enter gross contract income to assess it.',
  effort: 'Step 1 · No more than half of the contract payment rewards personal skills or effort.',
  results: 'Step 2 · At least 75% of PSI meets all three results conditions. Client concentration does not affect this pass.',
  concentration: 'Step 3 · The results test failed and one client group accounts for at least 80% of PSI. A covering ATO determination is needed to qualify.',
  clients: 'Step 4 · Below 80% from each client group, with at least two unrelated clients obtained directly through public offers.',
  employment: 'Step 4 · Below 80% from each client group, and the 20% principal work threshold or apprentice condition is met.',
  premises: 'Step 4 · Below 80% from each client group, and all the business premises conditions are met.',
  'other-tests': 'Step 4 · Below 80% from each client group, but no other PSB test passes and no covering determination was entered.',
  determination: 'ATO determination · An existing determination entered for this worker and year covers the PSI.',
}

function renderScenario(prefix, scenario) {
  display(`${prefix}-worker`, format(scenario?.workerAdditionalTax))
  display(`${prefix}-associate`, format(scenario?.associateAdditionalTax))
  display(`${prefix}-company`, format(scenario?.companyTax))
  display(`${prefix}-total`, format(scenario?.totalTax))
}

function render() {
  const company = form.elements.structure.value === 'company'
  companySettings.hidden = !company
  for (const control of companySettings.querySelectorAll('input, select')) control.disabled = !company

  const inputs = Object.fromEntries(Array.from(form.elements, control => [
    control.name,
    control.type === 'checkbox' ? control.checked : control.type === 'number' ? control.valueAsNumber : control.value,
  ]))
  if (!company) {
    inputs.promptSalary = 0
    inputs.companyRate = 25
  }
  inputs.companyRate = Number(inputs.companyRate)

  let result
  try {
    result = calculateTaxShock(inputs)
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    errorBox.textContent = error.message
    errorBox.hidden = false
    estimate.hidden = true
    return
  }

  const { assessment, caught, psb, disallowed, taxDifference, currentTax } = result
  const noIncome = assessment.trigger === 'no-income'
  errorBox.hidden = true
  estimate.hidden = false
  verdict.dataset.status = assessment.status
  display('status', noIncome ? 'No contract income entered' : verdictLabels[assessment.status])
  display('trigger', triggerLabels[assessment.trigger])
  const gapSummary = taxDifference > 0
    ? `The PSI rules add ${format(taxDifference)} to the annual scenario.`
    : taxDifference < 0
      ? `The PSI rules reduce annual tax by ${format(-taxDifference)} under these inputs.`
      : caught ? 'The entered scenarios produce the same annual tax.' : ''
  display('gap-summary', gapSummary)
  display('current-tax', format(noIncome ? null : currentTax))
  display('tax-gap', format(taxDifference))
  display('disallowed-total', format(disallowed?.total))
  display('attributed', format(company ? caught?.attributedProfit : null))
  display('disallowed-detail', disallowed
    ? `The caught scenario denies ${format(disallowed.occupancy)} in occupancy deductions and ${format(disallowed.associateAdmin)} in associate admin deductions.`
    : 'The PSI deduction limits do not apply to the modeled income.')
  display('ordinary-heading', caught ? 'PSB pass' : 'Ordinary rules')
  renderScenario('ordinary', noIncome ? null : psb)
  renderScenario('caught', caught)
  const ordinaryDetail = company
    ? `Under ordinary rules, the company retains ${format(psb.companyProfit)} before company tax.`
    : `Under ordinary rules, the sole trader reports ${format(psb.workerBusinessIncome)} of positive business income.`
  const caughtDetail = company
    ? `Under the PSI rules, the worker reports ${format(caught?.promptSalary)} in prompt salary and ${format(caught?.attributedProfit)} in attributed PSI.`
    : `Under the PSI rules, the sole trader reports ${format(caught?.workerBusinessIncome)} of positive net PSI directly.`
  display('scenario-detail', noIncome ? '' : caught ? `${ordinaryDetail} ${caughtDetail}` : ordinaryDetail)
}

form.addEventListener('submit', event => event.preventDefault())
form.addEventListener('input', render)
render()
