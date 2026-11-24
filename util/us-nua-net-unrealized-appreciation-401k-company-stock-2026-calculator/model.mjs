const EARLY_DISTRIBUTION_AGE = 59.5
const EARLY_DISTRIBUTION_TAX = 0.10
const NIIT_RATE = 0.038

const numericRanges = {
  fmv: [0, 1e9],
  basis: [0, 1e9],
  nonStock: [0, 1e9],
  age: [45, 80],
  currentRate: [0, 37],
  retirementRate: [0, 37],
  years: [0, 20],
  growthRate: [-100, 50],
}

// Dollar inputs are pretax plan amounts. Rate inputs are percentages.
export function calculateNua(inputs) {
  for (const [key, [min, max]] of Object.entries(numericRanges)) {
    const value = inputs[key]
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(`${key} must be between ${min} and ${max}.`)
    }
  }

  const {
    fmv, basis, nonStock, age, ruleOf55, currentRate, retirementRate,
    ltcgRate, niit, years, growthRate,
  } = inputs
  if (![0, 15, 20].includes(ltcgRate)) throw new RangeError('Choose a 0%, 15%, or 20% LTCG rate.')
  if (typeof ruleOf55 !== 'boolean' || typeof niit !== 'boolean') {
    throw new RangeError('Rule of 55 and NIIT inputs must be boolean.')
  }

  const growthFactor = (1 + growthRate / 100) ** years
  const saleValue = fmv * growthFactor
  const builtInNua = Math.max(0, fmv - basis)
  const taxableBasis = Math.min(basis, fmv)
  const realizedNua = Math.min(builtInNua, Math.max(0, saleValue - taxableBasis))
  const postGain = Math.max(0, saleValue - fmv)
  const capitalLoss = Math.max(0, taxableBasis - saleValue)

  const basisTax = taxableBasis * currentRate / 100
  const exemptBySeparation = ruleOf55 && age >= 54
  // A qualifying separation can occur at 54 if age 55 is reached that calendar year.
  const earlyPenalty = age < EARLY_DISTRIBUTION_AGE && !exemptBySeparation
    ? taxableBasis * EARLY_DISTRIBUTION_TAX : 0
  const upfrontTax = basisTax + earlyPenalty
  const basisRatio = fmv > 0 ? basis / fmv : null

  const postGainRate = (years > 1 ? ltcgRate : currentRate) / 100
  const nuaSaleTax = realizedNua * ltcgRate / 100
  const postGainTax = postGain * postGainRate
  const postGainNiit = niit ? postGain * NIIT_RATE : 0
  const niitSavedOnNua = niit ? realizedNua * NIIT_RATE : 0

  const futureNonStock = nonStock * growthFactor
  const futurePlanValue = saleValue + futureNonStock
  const nonStockIraTax = futureNonStock * retirementRate / 100
  const iraTax = futurePlanValue * retirementRate / 100
  const nuaFutureTax = nuaSaleTax + postGainTax + postGainNiit + nonStockIraTax
  const nuaTax = upfrontTax + nuaFutureTax

  // Compare at the same horizon, including growth forgone on cash spent on upfront tax.
  const futureUpfrontCost = upfrontTax * growthFactor
  const nuaWealth = futurePlanValue - nuaFutureTax - futureUpfrontCost
  const iraWealth = futurePlanValue - iraTax

  return {
    saleValue, builtInNua, realizedNua, postGain, capitalLoss,
    basisTax, earlyPenalty, upfrontTax, basisRatio, postGainRate,
    nuaSaleTax, postGainTax, postGainNiit, niitSavedOnNua,
    nonStockIraTax, nuaTax, iraTax, taxSaved: iraTax - nuaTax,
    futureUpfrontCost, nuaWealth, iraWealth, wealthDifference: nuaWealth - iraWealth,
  }
}
