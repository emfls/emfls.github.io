import { compare, RULES } from './model.mjs'

const byId = id => document.getElementById(id)
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const money = value => currency.format(value)
const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent', maximumFractionDigits: 2,
})
const taxYear = year => {
  const start = 2025 + year
  return `${start}/${String(start + 1).slice(-2)}`
}

const form = byId('pension-form')
const fields = ['pot', 'usedLsa', 'otherIncome', 'annualTarget', 'growth', 'years'].map(byId)
const error = byId('input-error')
const comparison = byId('comparison')
const refundRoute = byId('refund-route')
const emergencyMetrics = byId('emergency-metrics')
const labels = {
  upfront: 'A · Upfront PCLS only',
  phased: 'B · Phased drawdown',
  ufpls: 'C · UFPLS slices',
}
const refundGuidance = {
  P55: 'P55 may apply to this partial withdrawal if you are eligible for an in-year claim and will take no regular payments.',
  P53Z: 'P53Z may apply if you emptied the pot and have other employment or private pension income.',
  P50Z: 'P50Z may apply if you emptied the pot, have stopped working and have no other income apart from possible State Pension.',
}

function element(tag, content) {
  const node = document.createElement(tag)
  if (content !== undefined) node.textContent = content
  return node
}

function entries(list, items) {
  list.replaceChildren(...items.map(([label, value]) => {
    const group = element('div')
    group.append(element('dt', label), element('dd', value))
    return group
  }))
}

function strategyCard(key, strategy, years, priorMpaa) {
  const card = element('article')
  card.className = 'strategy-card'
  const details = element('dl')
  const allowance = strategy.status === 'SAFE_60K'
    ? `${money(RULES.annualAllowance)} standard annual allowance`
    : `${money(RULES.mpaa)} MPAA`
  const items = [
    [`${years}-year net pension cash`, money(strategy.net)],
    ['Total Income Tax on withdrawals', money(strategy.tax)],
    ['Tax-free cash withdrawn', money(strategy.taxFree)],
    ['LSA used including earlier withdrawals', percent.format(strategy.lsaUsedPercent / 100)],
    ['Pension balance at end', money(strategy.remaining)],
    ['Potential tax-free cash still in pension', money(strategy.remainingTaxFree)],
    ['Pension contribution allowance', allowance],
  ]
  if (years > 10) items.splice(1, 0, ['10-year net pension cash', money(strategy.netAtTen)])
  entries(details, items)
  const status = element('p', strategy.status)
  status.className = 'status'
  const trigger = priorMpaa ? 'Already triggered before this projection.'
    : strategy.triggerYear === null ? 'No trigger in this projection.'
    : `First trigger in ${taxYear(strategy.triggerYear)}.`
  card.append(element('h3', labels[key]), details, status, element('p', trigger))
  return card
}

function renderAnnual(strategies) {
  const items = Object.values(strategies)
  const rows = items[0].rows.map((year, index) => {
    const row = element('tr')
    const heading = element('th', taxYear(year.year))
    heading.scope = 'row'
    row.append(heading)
    for (const strategy of items) {
      const data = strategy.rows[index]
      row.append(element('td', money(data.tax)), element('td', money(data.net)))
    }
    return row
  })
  byId('annual-results').replaceChildren(...rows)
}

function renderEmergency(emergency) {
  emergencyMetrics.hidden = !emergency
  if (!emergency) {
    refundRoute.textContent = 'There is no UFPLS payment in the first year for these inputs.'
    return
  }
  entries(emergencyMetrics, [
    ['First gross UFPLS payment', money(emergency.gross)],
    ['Taxable part of payment', money(emergency.taxable)],
    ['Month 1 tax withheld', money(emergency.withheld)],
    ['Full-year tax on the withdrawal', money(emergency.trueTax)],
    ['Estimated overpayment to reclaim', money(emergency.refund)],
    ['Estimated cash on payment day', money(emergency.takeHome)],
  ])
  if (emergency.route) refundRoute.textContent = refundGuidance[emergency.route]
  else if (emergency.additionalTax > 0) {
    refundRoute.textContent = `Estimated additional tax still due after withholding is ${money(emergency.additionalTax)}.`
  } else refundRoute.textContent = 'No emergency tax overpayment is estimated.'
}

function render() {
  const invalid = fields.find(field => !field.validity.valid)
  for (const field of fields) {
    if (field.validity.valid) field.removeAttribute('aria-invalid')
    else field.setAttribute('aria-invalid', 'true')
  }
  if (invalid) {
    error.textContent = `${invalid.labels[0].textContent}. ${invalid.validationMessage}`
    error.hidden = false
    comparison.hidden = true
    emergencyMetrics.hidden = true
    refundRoute.textContent = 'Enter valid figures to estimate first-payment withholding.'
    return
  }

  const inputs = Object.fromEntries(fields.map(field => [field.id, field.valueAsNumber]))
  inputs.priorMpaa = byId('priorMpaa').checked
  inputs.statePensionOnly = byId('statePensionOnly').checked
  const result = compare(inputs)
  error.hidden = true
  comparison.hidden = false

  byId('result-period').textContent = `Tax years ${taxYear(1)} to ${taxYear(inputs.years)}, at 2026/27 rates.`
  entries(byId('metrics'), [
    ['Maximum tax-free cash today', money(result.maxTaxFree)],
    ['LSA remaining before withdrawal', money(result.lsaLeft)],
    ['LSA used after taking maximum today', percent.format(result.lsaUsedAfterMaxPercent / 100)],
    ['Taxable pension income before higher rate', money(result.basicHeadroom)],
    ['Taxable pension income covered by Personal Allowance', money(result.zeroTaxHeadroom)],
  ])
  byId('strategies').replaceChildren(...Object.entries(result.strategies).map(([key, strategy]) =>
    strategyCard(key, strategy, inputs.years, inputs.priorMpaa)
  ))
  renderAnnual(result.strategies)
  renderEmergency(result.emergency)
}

form.addEventListener('input', render)
form.addEventListener('submit', event => {
  event.preventDefault()
  render()
})
render()
