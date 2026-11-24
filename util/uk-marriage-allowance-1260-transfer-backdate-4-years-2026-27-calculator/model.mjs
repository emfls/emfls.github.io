export const PERSONAL_ALLOWANCE = 12_570
export const TRANSFER = Math.ceil((PERSONAL_ALLOWANCE * 0.10) / 10) * 10
export const DONOR_ALLOWANCE = PERSONAL_ALLOWANCE - TRANSFER
export const MAX_CREDIT = TRANSFER * 0.20
export const MAX_AMOUNT = 100_000_000

// Scottish thresholds are cumulative taxable income above the Personal Allowance.
const SCOTTISH_BANDS = {
  '2026/27': [3_967, 16_956],
  '2025/26': [2_827, 14_921],
  '2024/25': [2_306, 13_991],
  '2023/24': [2_162, 13_118],
  '2022/23': [2_162, 13_118]
}
const SCOTTISH_INTERMEDIATE_LIMIT = 31_092
const RUK_BASIC_LIMIT = 37_700
export const TAX_YEARS = Object.freeze(Object.keys(SCOTTISH_BANDS))

function pence(amount) {
  const pennies = Math.round(amount * 100)
  if (typeof amount !== 'number' || !Number.isFinite(amount) ||
      amount < 0 || amount > MAX_AMOUNT || pennies / 100 !== amount) {
    throw new RangeError('Enter a non-negative amount to the nearest penny.')
  }
  return pennies
}

function eligibleTax(taxablePence, region, year) {
  if (region !== 'scotland') return Math.round(taxablePence * 20 / 100)

  const [starterLimit, basicLimit] = SCOTTISH_BANDS[year].map(limit => limit * 100)
  const starter = Math.min(taxablePence, starterLimit)
  const basic = Math.max(0, Math.min(taxablePence, basicLimit) - starterLimit)
  const intermediate = Math.max(0, taxablePence - basicLimit)
  return Math.round((starter * 19 + basic * 20 + intermediate * 21) / 100)
}

// All public monetary inputs and outputs are in pounds. Round each person's tax
// impact to pennies before adding, so the displayed amounts reconcile.
export function estimateYear(year, { donorIncome, recipientIncome, region, bandExtension = 0 }) {
  if (!TAX_YEARS.includes(year)) throw new RangeError('Choose a supported tax year.')
  if (!['ruk', 'wales', 'scotland'].includes(region)) throw new RangeError('Choose a UK tax regime.')

  const donor = pence(donorIncome)
  const recipient = pence(recipientIncome)
  const extension = pence(bandExtension)
  if ((region === 'scotland' && extension > 0) || extension > recipient) {
    throw new RangeError('Enter a valid rUK basic-rate band extension.')
  }

  const recipientTaxable = recipient - PERSONAL_ALLOWANCE * 100
  const recipientLimit = region === 'scotland'
    ? SCOTTISH_INTERMEDIATE_LIMIT * 100
    : RUK_BASIC_LIMIT * 100 + extension

  let reason = null
  if (donor > PERSONAL_ALLOWANCE * 100) reason = 'donor-over-allowance'
  else if (recipientTaxable <= 0) reason = 'recipient-no-tax'
  else if (recipientTaxable > recipientLimit) reason = 'recipient-higher-rate'
  if (reason) return { eligible: false, reason, credit: 0, donorTax: 0, net: 0, codes: null }

  const credit = Math.min(MAX_CREDIT * 100, eligibleTax(recipientTaxable, region, year))
  const donorTaxable = Math.max(0, donor - DONOR_ALLOWANCE * 100)
  const donorTax = eligibleTax(donorTaxable, region, year)
  const prefix = { ruk: '', wales: 'C', scotland: 'S' }[region]

  return {
    eligible: true,
    reason: null,
    credit: credit / 100,
    donorTax: donorTax / 100,
    net: (credit - donorTax) / 100,
    codes: {
      recipient: region === 'scotland' ? null : prefix + '1383M',
      donor: prefix + '1131N'
    }
  }
}

// Pass only selected years, each with that year's own incomes and tax regime.
export function estimateClaim(selectedYears) {
  const years = Object.fromEntries(Object.entries(selectedYears).map(([year, values]) => [
    year, estimateYear(year, values)
  ]))
  const current = years[TAX_YEARS[0]] ?? null
  let refundPence = 0
  let donorTaxPence = 0
  for (const year of TAX_YEARS.slice(1)) {
    if (!years[year]) continue
    refundPence += pence(years[year].credit)
    donorTaxPence += pence(years[year].donorTax)
  }
  const backdatedNet = refundPence - donorTaxPence

  return {
    years,
    current,
    backdatedRefund: refundPence / 100,
    backdatedDonorTax: donorTaxPence / 100,
    backdatedNet: backdatedNet / 100,
    combinedNet: (backdatedNet + Math.round((current?.net ?? 0) * 100)) / 100
  }
}
