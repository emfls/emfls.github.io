export const PARAMETERS = Object.freeze({
  effortThreshold: 50,
  resultsThreshold: 75,
  clientThreshold: 80,
  publicClientsMinimum: 2,
  principalWorkMinimum: 20,
  medicareRate: 0.02,
  baseCompanyRate: 25,
  fullCompanyRate: 30,
})

const RESIDENT_BRACKETS = [
  { from: 18_200, to: 45_000, rate: 0.15 },
  { from: 45_000, to: 135_000, rate: 0.30 },
  { from: 135_000, to: 190_000, rate: 0.37 },
  { from: 190_000, to: Infinity, rate: 0.45 },
]

export const DEFAULTS = Object.freeze({
  grossIncome: 210_000,
  effortShare: 95,
  resultsShare: 35,
  paidForResult: true,
  providesTools: true,
  rectifiesDefects: true,
  largestClientShare: 85,
  publicClients: 1,
  principalWorkShare: 5,
  apprentice: false,
  premisesMaintained: false,
  premisesExclusive: false,
  premisesMainlyPSI: false,
  premisesSeparate: false,
  determination: false,
  structure: 'company',
  allowable: 18_000,
  occupancy: 6_000,
  associateAdmin: 12_000,
  promptSalary: 105_000,
  workerOtherIncome: 0,
  associateOtherIncome: 55_000,
  companyRate: PARAMETERS.baseCompanyRate,
  workerMedicare: true,
  associateMedicare: true,
})

const money = amount => Math.round(amount * 100) / 100

function requireNumber(value, label, max = Number.MAX_SAFE_INTEGER / 100) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(`${label} must be between 0 and ${max}.`)
  }
}

export function assessPSI(inputs) {
  requireNumber(inputs.grossIncome, 'Gross contract income')
  requireNumber(inputs.effortShare, 'Personal effort share', 100)
  requireNumber(inputs.resultsShare, 'Results test share', 100)
  requireNumber(inputs.largestClientShare, 'Largest client share', 100)
  requireNumber(inputs.principalWorkShare, 'Principal work share', 100)
  if (!Number.isSafeInteger(inputs.publicClients) || inputs.publicClients < 0) {
    throw new RangeError('Enter a whole number of eligible unrelated clients.')
  }

  if (inputs.grossIncome === 0) return { status: 'general', trigger: 'no-income' }
  if (inputs.effortShare <= PARAMETERS.effortThreshold) {
    return { status: 'general', trigger: 'effort' }
  }
  if (inputs.resultsShare >= PARAMETERS.resultsThreshold &&
      inputs.paidForResult && inputs.providesTools && inputs.rectifiesDefects) {
    return { status: 'psb', trigger: 'results' }
  }
  if (inputs.largestClientShare >= PARAMETERS.clientThreshold) {
    return inputs.determination
      ? { status: 'psb', trigger: 'determination' }
      : { status: 'psi', trigger: 'concentration' }
  }
  if (inputs.publicClients >= PARAMETERS.publicClientsMinimum) {
    return { status: 'psb', trigger: 'clients' }
  }
  if (inputs.principalWorkShare >= PARAMETERS.principalWorkMinimum || inputs.apprentice) {
    return { status: 'psb', trigger: 'employment' }
  }
  if (inputs.premisesMaintained && inputs.premisesExclusive &&
      inputs.premisesMainlyPSI && inputs.premisesSeparate) {
    return { status: 'psb', trigger: 'premises' }
  }
  return inputs.determination
    ? { status: 'psb', trigger: 'determination' }
    : { status: 'psi', trigger: 'other-tests' }
}

export function residentTax(taxableIncome, chargeMedicare = true) {
  requireNumber(taxableIncome, 'Taxable income')
  const incomeTax = RESIDENT_BRACKETS.reduce((sum, { from, to, rate }) =>
    sum + Math.max(0, Math.min(taxableIncome, to) - from) * rate, 0)
  const firstTaper = Math.min(7_500, Math.max(0, taxableIncome - 37_500)) * 0.05
  const secondTaper = Math.max(0, taxableIncome - 45_000) * 0.015
  const offset = Math.min(incomeTax, Math.max(0, 700 - firstTaper - secondTaper))
  const medicare = chargeMedicare ? taxableIncome * PARAMETERS.medicareRate : 0
  return {
    incomeTax: money(incomeTax),
    lowIncomeOffset: money(offset),
    medicare: money(medicare),
    total: money(incomeTax - offset + medicare),
  }
}

function businessTax(workerBusinessIncome, associateIncome, companyProfit, inputs) {
  const workerAdditionalTax = money(
    residentTax(inputs.workerOtherIncome + workerBusinessIncome, inputs.workerMedicare).total -
    residentTax(inputs.workerOtherIncome, inputs.workerMedicare).total)
  const associateAdditionalTax = money(
    residentTax(inputs.associateOtherIncome + associateIncome, inputs.associateMedicare).total -
    residentTax(inputs.associateOtherIncome, inputs.associateMedicare).total)
  const companyTax = money(companyProfit * inputs.companyRate / 100)
  return {
    workerBusinessIncome,
    associateIncome,
    companyProfit,
    workerAdditionalTax,
    associateAdditionalTax,
    companyTax,
    totalTax: money(workerAdditionalTax + associateAdditionalTax + companyTax),
  }
}

export function calculateTaxShock(inputs) {
  const assessment = assessPSI(inputs)
  const moneyFields = {
    allowable: 'Other allowable expenses',
    occupancy: 'Home occupancy expenses',
    associateAdmin: 'Associate admin pay',
    workerOtherIncome: 'Worker’s other taxable income',
    associateOtherIncome: 'Associate’s other taxable income',
    promptSalary: 'Worker salary',
  }
  for (const [key, label] of Object.entries(moneyFields)) requireNumber(inputs[key], label)

  if (!['company', 'sole-trader'].includes(inputs.structure)) {
    throw new RangeError('Select a company or sole trader.')
  }
  if (![PARAMETERS.baseCompanyRate, PARAMETERS.fullCompanyRate].includes(inputs.companyRate)) {
    throw new RangeError('Select a company rate of 25% or 30%.')
  }

  const company = inputs.structure === 'company'
  const netBeforeRestrictedCosts = money(inputs.grossIncome - inputs.allowable)
  const ordinaryProfit = money(netBeforeRestrictedCosts - inputs.occupancy - inputs.associateAdmin)
  const promptSalary = company ? money(inputs.promptSalary) : 0
  if (promptSalary > Math.max(0, ordinaryProfit)) {
    throw new RangeError('Worker salary cannot exceed the profit available after all entered costs in the ordinary-tax scenario.')
  }

  const disallowed = {
    occupancy: inputs.occupancy,
    associateAdmin: inputs.associateAdmin,
    total: money(inputs.occupancy + inputs.associateAdmin),
  }
  const psb = businessTax(
    company ? promptSalary : Math.max(0, ordinaryProfit),
    inputs.associateAdmin,
    company ? money(Math.max(0, ordinaryProfit - promptSalary)) : 0,
    inputs,
  )
  const taxableNetPSI = Math.max(0, netBeforeRestrictedCosts)
  const caught = assessment.status === 'general' ? null : {
    ...businessTax(taxableNetPSI, 0, 0, inputs),
    promptSalary,
    attributedProfit: company ? money(taxableNetPSI - promptSalary) : 0,
  }
  return {
    assessment,
    disallowed: caught ? disallowed : null,
    psb,
    caught,
    taxDifference: caught ? money(caught.totalTax - psb.totalTax) : null,
    currentTax: assessment.status === 'psi' ? caught.totalTax : psb.totalTax,
  }
}
