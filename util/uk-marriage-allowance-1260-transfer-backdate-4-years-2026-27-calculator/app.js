import { estimateClaim, MAX_AMOUNT, TAX_YEARS } from './model.mjs'

const form = document.querySelector('#claim-form')
const yearList = document.querySelector('#claim-years')
const template = document.querySelector('#year-template')
const results = document.querySelector('#results-content')
const status = document.querySelector('#results-status')
const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const money = amount => pounds.format(amount)
const messages = {
  'donor-over-allowance': 'Donor income exceeds £12,570, outside this calculator’s scope.',
  'recipient-no-tax': 'Recipient income is within the Personal Allowance.',
  'recipient-higher-rate': 'Recipient income reaches the higher-rate band.'
}

const yearControls = TAX_YEARS.map((year, index) => {
  const row = template.content.firstElementChild.cloneNode(true)
  const include = row.querySelector('[data-include]')
  const fields = row.querySelector('[data-fields]')
  const [donor, recipient, region, relief] = fields.querySelectorAll('input, select')
  const reliefField = row.querySelector('[data-relief]')
  const rowStatus = row.querySelector('[data-year-status]')

  include.checked = index === 0
  rowStatus.id = 'year-status-' + index
  fields.setAttribute('aria-label', 'Income and tax regime for ' + year)
  fields.setAttribute('aria-describedby', rowStatus.id)
  row.querySelector('[data-year]').textContent = index === 0 ? year + ' · current year' : year
  if (year === '2022/23') {
    row.querySelector('[data-deadline]').textContent = 'Claim by 5 April 2027'
  }
  for (const field of [donor, recipient, relief]) field.max = MAX_AMOUNT
  yearList.append(row)
  return { year, include, fields, donor, recipient, region, relief, reliefField, rowStatus }
})

function render() {
  const selected = {}
  let hasInvalidYear = false

  for (const { year, include, fields, donor, recipient, region, relief, reliefField, rowStatus } of yearControls) {
    fields.hidden = fields.disabled = !include.checked
    reliefField.hidden = relief.disabled = region.value === 'scotland'
    rowStatus.textContent = ''
    for (const input of [donor, recipient, relief]) input.removeAttribute('aria-invalid')
    if (!include.checked) continue

    const invalidInputs = [donor, recipient, relief].filter(input => {
      if (input.disabled) return false
      const amount = input.valueAsNumber
      return !input.validity.valid || Math.round(amount * 100) / 100 !== amount
    })
    if (!relief.disabled && invalidInputs.length === 0 && relief.valueAsNumber > recipient.valueAsNumber) {
      invalidInputs.push(relief)
      rowStatus.textContent = 'The band extension cannot exceed recipient income.'
    }
    if (invalidInputs.length) {
      hasInvalidYear = true
      for (const input of invalidInputs) input.setAttribute('aria-invalid', 'true')
      rowStatus.textContent ||= 'Enter amounts of £0 or more, with up to two decimal places.'
      continue
    }

    selected[year] = {
      donorIncome: donor.valueAsNumber,
      recipientIncome: recipient.valueAsNumber,
      region: region.value,
      bandExtension: relief.disabled ? 0 : relief.valueAsNumber
    }
  }

  results.hidden = hasInvalidYear
  status.textContent = hasInvalidYear ? 'Check the highlighted amounts to update the estimate.' : ''
  if (hasInvalidYear) return

  const claim = estimateClaim(selected)
  for (const { year, rowStatus } of yearControls) {
    const estimate = claim.years[year]
    if (!estimate) continue
    rowStatus.textContent = estimate.eligible
      ? money(estimate.credit) + ' recipient relief − ' + money(estimate.donorTax) +
        ' donor tax = ' + money(estimate.net) + ' household net.'
      : messages[estimate.reason]
    if (estimate.net < 0) rowStatus.textContent += ' This year would cost you more as a household.'
  }

  const { current } = claim
  document.querySelector('#current-net').textContent = current?.eligible ? money(current.net) : '—'
  document.querySelector('#current-detail').textContent = current?.eligible
    ? 'Recipient saves ' + money(current.credit) + ' · donor pays ' + money(current.donorTax)
    : current ? messages[current.reason] : '2026/27 is excluded.'
  document.querySelector('#backdated-refund').textContent = money(claim.backdatedRefund)
  document.querySelector('#backdated-detail').textContent =
    money(claim.backdatedDonorTax) + ' donor tax · ' + money(claim.backdatedNet) + ' household net'
  document.querySelector('#combined-net').textContent = money(claim.combinedNet)
  document.querySelector('#paye-codes').textContent = current?.codes
    ? 'Recipient ' + (current.codes.recipient ?? 'S…M (rate-dependent)') + ' · donor ' + current.codes.donor
    : '—'
}

form.addEventListener('input', render)
form.addEventListener('submit', event => event.preventDefault())
render()
