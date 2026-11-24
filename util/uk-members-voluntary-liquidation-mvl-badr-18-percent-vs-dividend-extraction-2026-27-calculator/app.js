import { compare } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const secondPerson = byId('person-2');
const results = byId('results');
const error = byId('error');
const breakevenNote = byId('breakeven-note');

const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const years = new Intl.NumberFormat('en-GB');
const percentagePoints = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const money = value => value === null ? 'Unavailable' : pounds.format(Math.abs(value) < 0.005 ? 0 : value);

function shareholder(number) {
  return {
    income: byId('income-' + number).valueAsNumber,
    prior: byId('prior-' + number).valueAsNumber,
    basis: byId('basis-' + number).valueAsNumber,
    exempt: byId('exempt-' + number).valueAsNumber,
    qualifies: byId('qualifies-' + number).checked
  };
}

function setText(id, value) {
  byId(id).textContent = value;
}

function setBar(id, net, cash) {
  const share = net === null || cash === 0 ? 0 : Math.max(0, Math.min(100, 100 * net / cash));
  byId(id).setAttribute('width', share.toFixed(4));
}

function render() {
  const joint = byId('joint').checked;
  secondPerson.hidden = !joint;
  secondPerson.disabled = !joint;

  const invalid = Array.from(form.querySelectorAll('input[type="number"]')).find(input =>
    input.willValidate && !input.validity.valid
  );
  if (invalid) {
    results.hidden = true;
    breakevenNote.hidden = true;
    error.textContent = 'Enter amounts in pounds and pence within the limits shown by each field (CGT exemption up to £3,000 and other fields up to £100 million).';
    error.hidden = false;
    return;
  }

  const cash = byId('cash').valueAsNumber;
  const people = joint ? [shareholder(1), shareholder(2)] : [shareholder(1)];
  const showCap = byId('use-cap').checked;
  const { fee, mvl, announced, lump, drip, taxSaved, savingsRate, netAdvantage, capExposure, breakeven } = compare({
    cash, fee: byId('fee').valueAsNumber, vat: byId('vat').checked, people
  });
  const third = showCap ? announced : drip;

  setText('mvl-net', money(mvl.available ? mvl.net : null));
  setText('mvl-detail', mvl.available
    ? money(mvl.tax) + ' CGT · ' + money(fee) + ' liquidator fee'
    : 'Retained cash is below the liquidator fee of ' + money(fee) + '.');
  setText('lump-net', money(lump.net));
  setText('lump-detail', money(lump.tax) + ' extra Income Tax · ' + (cash > 0 ? percent.format(lump.tax / cash) : '0%') + ' of company cash');
  setText('third-title', showCap ? 'MVL · announced £500k BADR cap' : 'Staged basic-rate dividends');
  setText('third-net', money(third.available ? third.net : null));

  if (showCap) {
    setText('third-detail', announced.available
      ? money(announced.tax) + ' CGT · models qualifying disposals from 6 April 2027'
      : 'Retained cash is below the liquidator fee.');
  } else {
    setText('third-detail', drip.available
      ? money(drip.tax) + ' total tax · ' + years.format(drip.years) + (drip.years === 1 ? ' tax year' : ' tax years')
        + ' · up to ' + money(drip.annualCapacity) + ' a year'
      : 'At least one shareholder has no basic-rate headroom for an equal dividend.');
  }

  setText('tax-saved', money(taxSaved));
  setText('rate-saved', savingsRate === null ? 'Unavailable' : percentagePoints.format(savingsRate * 100) + ' pp');
  setText('advantage', money(netAdvantage));
  setText('exposure', money(capExposure));
  setText('breakeven', money(breakeven));
  byId('third-bar').hidden = !third.available;
  setText('third-legend', showCap ? '£500k cap' : 'Staged');
  setBar('bar-mvl', mvl.available ? mvl.net : null, cash);
  setBar('bar-lump', lump.net, cash);
  setBar('bar-third', third.available ? third.net : null, cash);
  error.hidden = true;
  results.hidden = false;
  breakevenNote.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();
