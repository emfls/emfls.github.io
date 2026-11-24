export const MAX_AMOUNT = 100_000_000_000

const SMALL_RATE = 0.19
const MAIN_RATE = 0.25
const SMALL_LIMIT = 50_000
const MAIN_LIMIT = 250_000
const RDEC_RATE = 0.20
const ERIS_RATE = 0.145
const ERIS_ENHANCEMENT = 0.86
const PATENT_RATE = 0.10

const pence = amount => Math.round(amount * 100)
const money = amount => Math.round((amount + Number.EPSILON * Math.abs(amount)) * 100) / 100

function validateAmount(amount, label, minimum = 0) {
  if (!Number.isFinite(amount) || amount < minimum || amount > MAX_AMOUNT ||
      pence(amount) / 100 !== amount) {
    throw new RangeError(`Enter a valid ${label} in pounds and pence.`)
  }
}

// Standalone company, full year, with taxable profits equal to augmented profits.
export function corporationTax(profit) {
  validateAmount(profit, 'taxable profit', -MAX_AMOUNT)
  return money(taxOn(profit))
}

function taxOn(profit) {
  if (profit <= 0) return 0
  if (profit <= SMALL_LIMIT) return profit * SMALL_RATE
  return profit * MAIN_RATE - Math.max(0, MAIN_LIMIT - profit) * (3 / 200)
}

function mergedRdec(rdSpend, tradingResult, cap) {
  const gross = money(rdSpend * RDEC_RATE)
  const taxBefore = money(taxOn(tradingResult))
  const taxAfter = money(taxOn(money(tradingResult + gross)))
  const taxIncrease = money(taxAfter - taxBefore)
  const ctOffset = Math.min(gross, taxAfter)
  const notionalRate = tradingResult > SMALL_LIMIT ? MAIN_RATE : SMALL_RATE
  const cashLimit = money(gross * (1 - notionalRate))
  const creditAfterOffset = money(gross - ctOffset)
  const notionalWithheld = money(Math.max(0, creditAfterOffset - cashLimit))
  const payableBeforeCap = money(creditAfterOffset - notionalWithheld)
  const cashBeforeOtherOffsets = Math.min(payableBeforeCap, cap)

  return {
    gross, taxIncrease, ctOffset, notionalRate, notionalWithheld, cashBeforeOtherOffsets,
    netBenefit: money(gross - taxIncrease - notionalWithheld),
    step3CarryForward: money(payableBeforeCap - cashBeforeOtherOffsets),
    periodBenefit: money(ctOffset + cashBeforeOtherOffsets - taxIncrease)
  }
}

function enhancedSupport(rdSpend, tradingResult, eligible, cap) {
  if (!eligible) return { eligible: false }
  const enhancement = money(rdSpend * ERIS_ENHANCEMENT)
  const enhancedLoss = money(-tradingResult + enhancement)
  const surrenderableLoss = Math.min(enhancedLoss, money(rdSpend + enhancement))
  const uncappedCash = money(surrenderableLoss * ERIS_RATE)
  const cash = Math.min(uncappedCash, cap)
  const capped = cash < uncappedCash
  const lossSurrendered = capped ? money(cash / ERIS_RATE) : surrenderableLoss

  return {
    eligible, enhancement, enhancedLoss, surrenderableLoss, lossSurrendered,
    uncappedCash, cash, capped, lossRemaining: money(enhancedLoss - lossSurrendered)
  }
}

export function calculate({
  rdSpend, totalSpend, tradingResult, payroll, ipProfit,
  isSme, gracePeriod = false, capExempt = false
}) {
  validateAmount(rdSpend, 'qualifying R&D spend')
  validateAmount(totalSpend, 'total relevant expenditure')
  validateAmount(tradingResult, 'trading profit or loss', -MAX_AMOUNT)
  validateAmount(payroll, 'PAYE and Class 1 NIC amount')
  validateAmount(ipProfit, 'qualifying IP profit')
  if (rdSpend > totalSpend) {
    throw new RangeError('Qualifying R&D spend must be within total relevant expenditure.')
  }
  if (![isSme, gracePeriod, capExempt].every(value => typeof value === 'boolean')) {
    throw new RangeError('Select valid eligibility options.')
  }

  const intensity = totalSpend > 0 ? rdSpend / totalSpend : null
  const meetsIntensity = totalSpend > 0 && pence(rdSpend) * 10 >= pence(totalSpend) * 3
  const eligible = rdSpend > 0 && isSme && tradingResult < 0 && (meetsIntensity || gracePeriod)
  const cap = capExempt ? Infinity : money(20_000 + payroll * 3)
  const rdec = mergedRdec(rdSpend, tradingResult, cap)
  const eris = enhancedSupport(rdSpend, tradingResult, eligible, cap)
  const mainTax = money(ipProfit * MAIN_RATE)
  const patentTax = money(ipProfit * PATENT_RATE)
  const patentBox = { mainTax, patentTax, saving: money(mainTax - patentTax) }

  let estimatedScheme = 'None'
  if (rdSpend > 0) {
    estimatedScheme = 'Merged RDEC'
    if (eligible && eris.cash >= rdec.periodBenefit) {
      estimatedScheme = eris.cash === rdec.periodBenefit ? 'Tied' : 'ERIS'
    }
  }
  return {
    intensity, meetsIntensity, estimatedScheme, rdec, eris, patentBox,
    payrollCap: { exempt: capExempt, amount: capExempt ? null : cap }
  }
}
