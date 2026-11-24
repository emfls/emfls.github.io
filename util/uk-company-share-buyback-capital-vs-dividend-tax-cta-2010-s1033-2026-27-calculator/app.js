import { calculateBuyback, checkEligibility } from './model.mjs'

const form = document.querySelector('#buyback-form')
const results = document.querySelector('#results')
const error = document.querySelector('#input-error')
const checklist = document.querySelector('#checklist')
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const gbp = value => currency.format(value)
const setText = (id, value) => { document.getElementById(id).textContent = value }

function render() {
  try {
    const input = {}
    for (const field of form.elements) {
      if (!field.name) continue
      if (!field.validity.valid) {
        throw new Error(`${field.labels[0].textContent}: ${field.validationMessage}`)
      }
      input[field.name] = field.type === 'checkbox' ? field.checked : field.valueAsNumber
    }

    const result = calculateBuyback(input)
    const { checks, requiredYears, passesStatutory, passesScreen } = checkEligibility(input)
    for (const [id, value] of Object.entries({
      'capital-net': result.capitalNet,
      'dividend-net': result.dividendNet,
      'capital-saving': Math.abs(result.capitalSaving),
      'stamp-duty': result.stampDuty,
      'capital-tax': result.capital.tax,
      'future-tax': result.future.tax,
      'delay-cost': result.delayCost,
      'dividend-tax': result.distributionRouteTax,
    })) {
      setText(id, gbp(value))
    }
    setText('saving-label', result.capitalSaving < 0
      ? 'Extra seller tax with capital treatment'
      : 'Seller tax saved with capital treatment')

    setText('capital-detail', `Capital gain ${gbp(result.capitalGain)}. Taxable gain at 18% BADR ${gbp(result.capital.taxableBadr)} in 2026/27 and ${gbp(result.future.taxableBadr)} under the proposed cap. Other 2026/27 gain at 18%: ${gbp(result.capital.basicRateGain)}. At 24%: ${gbp(result.capital.higherRateGain)}.`)
    const residual = result.residualGain < 0
      ? `Separate capital loss ${gbp(-result.residualGain)}. Any use of that loss is outside the estimate.`
      : `CGT on remaining proceeds ${gbp(result.residualCgt)}.`
    setText('dividend-detail', `Dividend distribution ${gbp(result.distribution)}. Dividend tax increases by ${gbp(result.dividendTaxIncrease)} and tax on other income by ${gbp(result.otherIncomeTaxIncrease)}. Personal Allowance moves from ${gbp(result.allowanceBefore)} to ${gbp(result.allowanceAfter)}. ${residual}`)

    let status = 'FAIL · One or more Condition A checks failed. Default distribution treatment is the baseline in this comparison.'
    if (passesScreen) {
      status = 'PASS · The entered facts pass the Condition A screen.'
    } else if (passesStatutory) {
      status = 'REVIEW · Exactly 30% passes the statutory percentage threshold and fails the strict under-30% screen.'
    }
    setText('eligibility', status)

    const labels = {
      unquotedTrading: 'Unquoted trading company or qualifying holding company',
      tradeBenefit: 'Benefit of trade',
      ukResident: 'UK-resident seller',
      cleanArrangement: 'No disqualifying arrangement',
      ownership: `Qualifying ownership of at least ${requiredYears} years`,
      substantialReduction: 'Post-buyback shareholding at most 75% of prior interest',
      statutoryConnection: 'Statutory connection threshold of no more than 30%',
      strictConnection: 'Strict planning screen under 30%',
      otherConditions: 'Profit entitlement, group and other applicable requirements confirmed',
    }
    checklist.replaceChildren(...Object.entries(labels).map(([key, label]) => {
      const item = document.createElement('li')
      item.textContent = `${checks[key] ? 'PASS' : 'FAIL'} · ${label}`
      return item
    }))
    results.hidden = false
    error.hidden = true
  } catch (problem) {
    results.hidden = true
    error.hidden = false
    error.textContent = problem.message
  }
}

form.addEventListener('submit', event => event.preventDefault())
form.addEventListener('input', render)
render()
