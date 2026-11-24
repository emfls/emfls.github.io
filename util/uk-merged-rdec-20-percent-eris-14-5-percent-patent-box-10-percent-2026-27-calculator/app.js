import { calculate } from './model.mjs'

const byId = id => document.getElementById(id)
const form = byId('relief-form')
const error = byId('error')
const results = byId('results')
const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 4 })
const write = (id, text) => { byId(id).textContent = text }
const showMoney = (id, amount) => write(id, pounds.format(amount))
const value = id => byId(id).valueAsNumber
const checked = id => byId(id).checked

function renderRdec(rdec) {
  showMoney('rdec-benefit', rdec.periodBenefit)
  showMoney('rdec-gross', rdec.gross)
  showMoney('rdec-tax', rdec.taxIncrease)
  showMoney('rdec-offset', rdec.ctOffset)
  showMoney('rdec-withheld', rdec.notionalWithheld)
  showMoney('rdec-net', rdec.netBenefit)
  showMoney('rdec-cash', rdec.cashBeforeOtherOffsets)
  showMoney('rdec-deferred', rdec.step3CarryForward)
}

function renderEris(estimate, inputs) {
  const { eris, meetsIntensity } = estimate
  byId('eris-detail').hidden = !eris.eligible
  if (!eris.eligible) {
    const missing = []
    if (inputs.rdSpend === 0) missing.push('qualifying R&D spend')
    if (!inputs.isSme) missing.push('SME status')
    if (inputs.tradingResult >= 0) missing.push('a tax trading loss before enhancement')
    if (!meetsIntensity && !inputs.gracePeriod) missing.push('30% intensity or an eligible grace period')
    write('eris-status', `Eligibility requires ${missing.join(', ')}.`)
    return
  }

  const basis = meetsIntensity ? 'Meets the 30% intensity test.' : 'Uses the one-year grace period.'
  write('eris-status', eris.capped ? `${basis} The PAYE cap reduces the cash credit.` : basis)
  showMoney('eris-cash', eris.cash)
  showMoney('eris-enhancement', eris.enhancement)
  showMoney('eris-loss', eris.enhancedLoss)
  showMoney('eris-surrenderable', eris.surrenderableLoss)
  showMoney('eris-uncapped', eris.uncappedCash)
  showMoney('eris-surrendered', eris.lossSurrendered)
  showMoney('eris-remaining', eris.lossRemaining)
}

function update() {
  const inputs = {
    rdSpend: value('rd-spend'),
    totalSpend: value('total-spend'),
    tradingResult: value('trading-result') * (byId('trading-type').value === 'loss' ? -1 : 1),
    payroll: value('payroll'),
    ipProfit: value('ip-profit'),
    isSme: checked('sme'),
    gracePeriod: checked('grace'),
    capExempt: checked('exempt')
  }

  let estimate
  try {
    if (value('trading-result') < 0) throw new RangeError('Enter the trading result as a positive amount or zero.')
    estimate = calculate(inputs)
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem
    results.hidden = true
    error.hidden = false
    error.textContent = problem.message
    return
  }

  error.hidden = true
  error.textContent = ''
  const { intensity, payrollCap, estimatedScheme, rdec, patentBox } = estimate
  const comparison = {
    None: 'Enter qualifying R&D spend to compare R&D relief.',
    Tied: 'Both schemes give the same estimated current-period benefit.',
    ERIS: 'ERIS gives the higher estimated current-period benefit.',
    'Merged RDEC': estimate.eris.eligible
      ? 'Merged RDEC gives the higher estimated current-period benefit.'
      : 'Merged RDEC is the applicable route on these inputs.'
  }
  write('comparison', comparison[estimatedScheme])
  let intensityLabel = intensity === null ? '—' : percent.format(intensity)
  if (!estimate.meetsIntensity && intensityLabel === '30%') intensityLabel = 'Just below 30%'
  write('intensity', intensityLabel)
  write('cap', payrollCap.exempt ? 'Exempt' : pounds.format(payrollCap.amount))
  renderRdec(rdec)
  renderEris(estimate, inputs)
  byId('patent-result').hidden = inputs.ipProfit === 0
  showMoney('patent-main', patentBox.mainTax)
  showMoney('patent-tax', patentBox.patentTax)
  showMoney('patent-saving', patentBox.saving)
  results.hidden = false
}

form.addEventListener('input', update)
form.addEventListener('submit', event => {
  event.preventDefault()
  update()
})
update()
