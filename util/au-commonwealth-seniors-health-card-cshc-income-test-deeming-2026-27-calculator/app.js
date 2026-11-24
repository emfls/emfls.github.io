import { calculateCSHC, estimateHealthcare } from './model.mjs'

const form = document.querySelector('#cshc-form')
const partnerFields = document.querySelector('#partner-fields')
const results = document.querySelector('#income-results')
const savings = document.querySelector('#savings-results')
const status = document.querySelector('#income-status')
const money = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'code',
  minimumFractionDigits: 2, maximumFractionDigits: 6
})

function show(id, value) {
  document.getElementById(id).textContent = value
}

function readNumber(name) {
  const field = form.elements.namedItem(name)
  if (field.matches(':disabled') || (field.value === '' && field.validity.valid)) return 0
  if (!field.validity.valid) {
    throw new RangeError(`${field.labels[0].textContent}: ${field.validationMessage}`)
  }
  return field.valueAsNumber
}

function renderIncome(household) {
  const partnerUnder60 = form.elements.partnerUnder60.checked
  const grandfathered = form.elements.grandfathered.checked
  const partnerGrandfathered = form.elements.partnerGrandfathered.checked
  partnerFields.hidden = partnerFields.disabled = household === 'single'
  form.elements.pensionBalance.disabled = grandfathered
  form.elements.partnerBalance.disabled = partnerUnder60 || partnerGrandfathered
  form.elements.partnerGrandfathered.disabled = partnerUnder60

  try {
    const result = calculateCSHC({
      household,
      dependentChildren: readNumber('dependentChildren'),
      taxableIncome: readNumber('taxableIncome'),
      targetForeignIncome: readNumber('targetForeignIncome'),
      totalNetInvestmentLosses: readNumber('totalNetInvestmentLosses'),
      reportableFringeBenefits: readNumber('reportableFringeBenefits'),
      reportableEmployerSuper: readNumber('reportableEmployerSuper'),
      pensionBalance: readNumber('pensionBalance'),
      partnerBalance: readNumber('partnerBalance'),
      grandfathered,
      partnerGrandfathered,
      partnerUnder60
    })

    const eligible = result.status === 'ELIGIBLE'
    status.dataset.status = result.status
    show('income-status', eligible ? 'Eligible · income test' : 'Over threshold · income test')
    show('margin-label', eligible ? 'Income headroom' : 'Income excess')
    show('income-margin', money.format(Math.abs(result.incomeMargin)))
    show('margin-note', result.incomeMargin === 0
      ? 'Your income is exactly at the limit. Equality fails the income test.'
      : 'Annual assessed income must be strictly below the limit.')
    show('income-limit', money.format(result.incomeLimit))
    show('adjusted-income', money.format(result.adjustedTaxableIncome))
    show('deemed-income', money.format(result.deemedIncome))
    show('total-income', money.format(result.totalCSHCIncome))
    show('rate-impact', money.format(result.additionalDeemedIncome))
    show('extra-balance', money.format(result.maximumExtraBalance))
    show('income-error', '')
    results.hidden = false
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    delete status.dataset.status
    show('income-status', 'Income result unavailable')
    show('income-error', error.message)
    results.hidden = true
  }
}

function renderSavings() {
  try {
    const estimate = estimateHealthcare({
      prescriptions: readNumber('prescriptions'),
      generalCopay: readNumber('generalCopay'),
      concessionCopay: readNumber('concessionCopay'),
      newlyBulkBilledVisits: readNumber('newlyBulkBilledVisits'),
      gpGap: readNumber('gpGap')
    })
    show('pbs-savings', money.format(estimate.pbsSavings))
    show('gp-savings', money.format(estimate.gpSavings))
    show('total-savings', money.format(estimate.total))
    show('savings-error', '')
    savings.hidden = false
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    show('savings-error', error.message)
    savings.hidden = true
  }
}

function render() {
  renderIncome(form.elements.household.value)
  renderSavings()
}

form.addEventListener('input', render)
form.addEventListener('change', render)
form.addEventListener('submit', event => event.preventDefault())
form.addEventListener('reset', () => setTimeout(render, 0))
render()
