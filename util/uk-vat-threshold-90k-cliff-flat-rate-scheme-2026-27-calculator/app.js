import { calculateVat, checkRegistration, LIMITS, SECTORS } from './model.mjs'

const field = id => document.getElementById(id)
const write = (id, value) => { field(id).textContent = value }
const value = id => field(id).valueAsNumber
const formatGBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const money = amount => formatGBP.format(Math.round(amount * 100) / 100 || 0)
const names = { benchmark: 'Unregistered benchmark', standard: 'Standard VAT', flat: 'Flat Rate Scheme' }
const sector = field('sector')
sector.replaceChildren(...SECTORS.map(([id, name, rate]) => new Option(name + ' · ' + rate + '%', id)),
  new Option('Custom rate', 'custom'))
const sectorRates = new Map(SECTORS.map(([id, , rate]) => [id, rate]))

function showField(wrapper, input, shown) {
  field(wrapper).hidden = !shown
  field(input).disabled = !shown
}

function profitMessage(drop) {
  const rounded = Math.round(drop * 100)
  if (!rounded) return 'same profit as the benchmark'
  return money(Math.abs(drop)) + (rounded > 0 ? ' less profit than the benchmark' : ' more profit than the benchmark')
}

function render() {
  const mix = field('mix').value
  const custom = sector.value === 'custom'
  const frsStatus = field('frs-status').value
  showField('share-field', 'b2c-share', mix === 'blended')
  showField('custom-field', 'custom-rate', custom)

  try {
    const registration = checkRegistration(value('historic'), value('forward'))
    const result = calculateVat({
      turnover: value('turnover'),
      b2cPercent: { b2c: 100, b2b: 0, blended: value('b2c-share') }[mix],
      costs: value('costs'),
      inputVat: value('reclaim'),
      relevantGoods: value('goods'),
      sectorRate: custom ? value('custom-rate') : sectorRates.get(sector.value),
      firstYear: field('first-year').checked,
      frsStatus,
    })

    const triggered = []
    if (registration.historic) triggered.push('past 12 months')
    if (registration.future) triggered.push('next 30 days')
    write('registration', triggered.length
      ? 'Compulsory registration threshold exceeded for ' + triggered.join(' and ') + '.'
      : 'The figures entered for the past 12 months and next 30 days are both within the registration threshold.')

    for (const name of ['benchmark', 'standard', 'flat']) {
      write(name + '-cash', money(result[name].cash))
      if (name === 'benchmark') continue
      write(name + '-receipts', money(result[name].receipts))
      write(name + '-vat', money(result[name].remittance))
    }
    write('effective-rate', result.flatRate + '%')
    const registeredDifference = (Math.round(result.flat.cash * 100) - Math.round(result.standard.cash * 100)) / 100
    let registeredWinner = 'Standard VAT is the available registered comparison.'
    if (result.frsAvailable) {
      registeredWinner = registeredDifference === 0
        ? 'Both VAT schemes return the same annual cash to the penny.'
        : names[registeredDifference > 0 ? 'flat' : 'standard'] + ' keeps ' + money(Math.abs(registeredDifference)) + ' more annual cash than the other VAT scheme.'
    }
    write('winner', 'Highest annual net cash · ' + result.winners.map(name => names[name]).join(' and ')
      + ' · ' + money(result.winnerCash) + '\n' + registeredWinner)

    let eligibility = frsStatus === 'joining'
      ? 'Within the £150,000 entry turnover limit.'
      : 'Within the £230,000 annual exit turnover limit on the sales shown.'
    if (result.aboveLeaveLimit) eligibility = 'Above the £230,000 annual gross income limit on sales alone.'
    else if (!result.frsAvailable) eligibility = 'Above the £150,000 entry limit on VAT-exclusive sales.'
    write('frs-check', 'Flat Rate Scheme · ' + eligibility
      + (result.frsAvailable ? '' : ' The flat-rate figures are illustrative and excluded from the winner.'))
    write('lct-check', (result.isLimited ? 'Limited cost rate applies.' : 'Sector rate applies.')
      + ' At this turnover, the annual relevant-goods minimum for the sector rate is ' + money(result.goodsMinimum) + '.')

    write('cliff-drop', 'At £90,000.01 under standard VAT · ' + profitMessage(result.cliffDrop) + '.')
    write('forecast-drop', 'At your forecast under standard VAT · ' + profitMessage(result.forecastDrop) + '.')
    write('recovery', result.recoveryTurnover <= LIMITS.registration + 0.01
      ? 'The benchmark is met at the first penny over the threshold. The post-threshold target is ' + money(result.recoveryTarget) + '.'
      : 'To recover the benchmark profit, aim for at least ' + money(result.recoveryTarget) + ' at current prices.'
        + (result.extraTurnover ? ' That is ' + money(result.extraTurnover) + ' above your forecast.' : ' Your forecast meets this target.'))

    field('error').hidden = true
    field('results').hidden = false
  } catch (error) {
    write('error', error.message)
    field('error').hidden = false
    field('results').hidden = true
  }
}

const form = field('vat-form')
form.addEventListener('input', render)
form.addEventListener('submit', event => event.preventDefault())
render()
