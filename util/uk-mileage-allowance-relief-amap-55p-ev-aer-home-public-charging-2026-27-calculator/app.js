import { calculateElectric, calculateMileage, calculatePayrollExcess } from './model.mjs'

const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const pence = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })
const get = (id) => document.getElementById(id)

const mileageForm = get('mileage-form')
const payrollForm = get('payroll-form')
const electricForm = get('electric-form')

function showAmounts(amounts) {
  for (const [id, amount] of Object.entries(amounts)) {
    get(id).textContent = currency.format(amount)
  }
}

function invalidInputMessage(input) {
  const label = input.labels[0].textContent
  if (input.validity.stepMismatch) return `Enter ${label} to the nearest penny.`
  return `Enter ${label} between ${input.min} and ${input.max}.`
}

function update(form, prefix, render) {
  const result = get(`${prefix}-result`)
  const error = get(`${prefix}-error`)
  const numbers = {}
  for (const input of form.querySelectorAll('input[type="number"]:enabled')) {
    if (!input.validity.valid) {
      result.hidden = true
      error.textContent = invalidInputMessage(input)
      return
    }
    numbers[input.name] = input.valueAsNumber
  }

  try {
    render(numbers)
    error.textContent = ''
    result.hidden = false
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem
    result.hidden = true
    error.textContent = problem.message
  }
}

function selectedVehicleAndYear() {
  return {
    vehicle: mileageForm.elements.vehicle.value,
    year: mileageForm.elements.year.value,
  }
}

function updateMileage() {
  const selection = selectedVehicleAndYear()
  const passengerFields = get('passengers')
  const eligible = selection.vehicle === 'car'
  passengerFields.hidden = !eligible
  get('passenger-results').hidden = !eligible || !passengerFields.open
  for (const input of passengerFields.querySelectorAll('input')) input.disabled = !eligible

  update(mileageForm, 'mileage', (numbers) => {
    const details = calculateMileage({
      ...selection,
      ...numbers,
      taxRate: Number(mileageForm.elements.taxRate.value),
      selfAssessment: mileageForm.elements.selfAssessment.checked,
    })
    showAmounts({
      allowance: details.allowance,
      'allowance-increase': details.allowanceIncrease,
      deduction: details.deduction,
      'tax-relief': details.taxRelief,
      'income-tax-excess': details.incomeTaxExcess,
      'total-claim': details.totalClaim,
      'passenger-allowance': details.passengerAllowance,
      'passenger-tax-free': details.taxFreePassengerPayment,
      'passenger-tax-excess': details.passengerTaxExcess,
    })
    get('filing-route').textContent = details.filingRoute === 'P87'
      ? 'P87 (postal claim)'
      : details.filingRoute ?? 'No mileage tax relief claim'
  })
}

function updatePayroll() {
  update(payrollForm, 'payroll', (numbers) => {
    const details = calculatePayrollExcess({ ...selectedVehicleAndYear(), ...numbers })
    showAmounts({ 'ni-qualifying': details.qualifyingAmount, 'ni-excess': details.payrollExcess })
  })
}

function updateElectric() {
  update(electricForm, 'electric', (numbers) => {
    const [homeRate, publicRate] = electricForm.elements.rates.value.split('/').map(Number)
    const details = calculateElectric({ ...numbers, homeRate, publicRate })
    showAmounts({
      'home-reimbursement': details.homeReimbursement,
      'public-reimbursement': details.publicReimbursement,
      'electric-reimbursement': details.reimbursement,
      'electric-cost': details.actualCost,
      'public-shortfall': details.publicShortfall,
      'net-shortfall': details.netShortfall,
    })
    get('home-cost-per-mile').textContent = `${pence.format(details.homeCostPerMile)}p/mi`
    get('public-cost-per-mile').textContent = `${pence.format(details.publicCostPerMile)}p/mi`
  })
}

mileageForm.addEventListener('input', updateMileage)
mileageForm.elements.vehicle.addEventListener('change', updatePayroll)
mileageForm.elements.year.addEventListener('change', updatePayroll)
get('passengers').addEventListener('toggle', updateMileage)
payrollForm.addEventListener('input', updatePayroll)
electricForm.addEventListener('input', updateElectric)
for (const form of [mileageForm, payrollForm, electricForm]) {
  form.addEventListener('submit', (event) => event.preventDefault())
}

function updateAll() {
  updateMileage()
  updatePayroll()
  updateElectric()
}

updateAll()
window.addEventListener('pageshow', updateAll)
