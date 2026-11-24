export const LIMITS = Object.freeze({
  registration: 90000,
  deregistration: 88000,
  benchmark: 89999,
  join: 150000,
  leave: 230000,
  goodsMinimum: 1000,
  standardRate: 20,
  limitedRate: 16.5,
  firstYearDiscount: 1,
  maxMoney: 10000000,
})

export const SECTORS = Object.freeze([
  ['it', 'Computer and IT consultancy or data processing', 14.5],
  ['management', 'Management consultancy', 14],
  ['financial', 'Financial services', 13.5],
  ['accountancy', 'Accountancy or book-keeping', 14.5],
  ['advertising', 'Advertising', 11],
  ['foodRetail', 'Food retail and related categories', 4],
  ['retail', 'Retail not listed elsewhere', 7.5],
  ['catering', 'Catering, including restaurants and takeaways', 12.5],
  ['construction', 'General building or construction services', 9.5],
  ['labour', 'Labour-only building or construction services', 14.5],
].map(Object.freeze))

function hundredths(value, maximum, label) {
  const units = Math.round(value * 100)
  if (!Number.isFinite(value) || value < 0 || value > maximum || units / 100 !== value) {
    throw new RangeError(label + ' must be between 0 and ' + maximum + ', with up to two decimal places.')
  }
  return units
}

function pennies(value, label) {
  return hundredths(value, LIMITS.maxMoney, label)
}

export function checkRegistration(past12Months, next30Days) {
  return {
    historic: pennies(past12Months, 'Past 12 months') > LIMITS.registration * 100,
    future: pennies(next30Days, 'Next 30 days') > LIMITS.registration * 100,
  }
}

export function calculateVat({
  turnover, b2cPercent, costs, inputVat, relevantGoods, sectorRate, firstYear, frsStatus,
}) {
  const annual = pennies(turnover, 'Annual turnover')
  const spending = pennies(costs, 'Annual costs')
  const reclaim = pennies(inputVat, 'Reclaimable VAT')
  const goods = pennies(relevantGoods, 'Relevant goods')
  const b2cShare = hundredths(b2cPercent, 100, 'B2C share')
  const sector = hundredths(sectorRate, 100, 'Sector rate')
  if (reclaim * 6 > spending || goods > spending) {
    throw new RangeError('Relevant goods must fit within annual costs, and reclaimable VAT cannot exceed one sixth of those VAT-inclusive costs.')
  }
  if (frsStatus !== 'joining' && frsStatus !== 'existing') {
    throw new RangeError('Choose whether you are joining or already using the Flat Rate Scheme.')
  }

  // Use integer comparisons at the thresholds. A share of 10,000 basis points is 100%.
  const netFactor = 60000 - b2cShare
  const salesNumerator = annual * netFactor
  const grossSales = salesNumerator / 50000
  const netSales = salesNumerator / 60000
  const outputVat = salesNumerator / 300000
  const isLimited = goods < LIMITS.goodsMinimum * 100 || goods * 50 * 50000 < salesNumerator
  const baseRate = isLimited ? LIMITS.limitedRate * 100 : sector
  const flatRate = Math.max(0, baseRate - (firstYear ? LIMITS.firstYearDiscount * 100 : 0))
  const flatPayable = grossSales * flatRate / 10000
  const standardPayable = outputVat - reclaim

  const joinLimitMet = salesNumerator <= LIMITS.join * 100 * 60000
  const aboveLeaveLimit = salesNumerator > LIMITS.leave * 100 * 50000
  const frsAvailable = !aboveLeaveLimit && (frsStatus === 'existing' || joinLimitMet)

  const benchmarkTurnover = LIMITS.benchmark * 100
  const cliffTurnover = LIMITS.registration * 100 + 1
  const benchmarkCash = benchmarkTurnover - spending
  const standardCash = netSales - spending + reclaim
  const flatCash = grossSales - spending - flatPayable
  const cliffCash = cliffTurnover * netFactor / 60000 - spending + reclaim
  const recovery = (benchmarkTurnover - reclaim) * 60000 / netFactor
  // Round the target up to a payable penny and keep it within the post-threshold scenario.
  const recoveryTarget = Math.max(cliffTurnover, Math.ceil(recovery))
  const candidates = { benchmark: benchmarkCash, standard: standardCash }
  if (frsAvailable) candidates.flat = flatCash
  const best = Math.max(...Object.values(candidates).map(Math.round))

  return {
    benchmark: { receipts: LIMITS.benchmark, remittance: 0, cash: benchmarkCash / 100 },
    standard: { receipts: grossSales / 100, remittance: standardPayable / 100, cash: standardCash / 100 },
    flat: { receipts: grossSales / 100, remittance: flatPayable / 100, cash: flatCash / 100 },
    netSales: netSales / 100,
    outputVat: outputVat / 100,
    goodsMinimum: Math.max(LIMITS.goodsMinimum * 100, Math.ceil(salesNumerator / 2500000)) / 100,
    isLimited,
    flatRate: flatRate / 100,
    joinLimitMet,
    aboveLeaveLimit,
    frsAvailable,
    cliffDrop: (benchmarkCash - cliffCash) / 100,
    forecastDrop: (benchmarkCash - standardCash) / 100,
    recoveryTurnover: recovery / 100,
    recoveryTarget: recoveryTarget / 100,
    extraTurnover: Math.max(0, recoveryTarget - annual) / 100,
    winners: Object.keys(candidates).filter(name => Math.round(candidates[name]) === best),
    winnerCash: best / 100,
    registeredEdge: frsAvailable ? (flatCash - standardCash) / 100 : null,
  }
}
