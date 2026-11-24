import { simulateInheritedIra } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('ira-form');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const factor = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const setText = (id, value) => { byId(id).textContent = value; };
const currency = amount => usd.format(Math.abs(amount) < 0.005 ? 0 : amount);

function numeric(id, optional = false) {
  const input = byId(id);
  if (optional && input.value === '' && input.validity.valid) return 0;
  if (!input.validity.valid) {
    throw new RangeError(`${input.labels[0].textContent}: ${input.validationMessage}`);
  }
  return input.valueAsNumber;
}

function renderSchedule({ minimum, level }) {
  const fragment = document.createDocumentFragment();
  function cells(row) {
    return [row.required, row.withdrawal, row.tax, row.closing].map(currency);
  }
  for (const [index, base] of minimum.rows.entries()) {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = base.year;
    row.append(heading);
    const divisor = base.divisor === null ? '—' : factor.format(base.divisor);
    for (const value of [divisor, ...cells(base), ...cells(level.rows[index])]) {
      row.insertCell().textContent = value;
    }
    fragment.append(row);
  }
  byId('schedule-body').replaceChildren(fragment);
}

function renderResults(result, roth) {
  const { minimum, level, taxSaved, deadlineYear, annualRmd, penalty } = result;
  if (deadlineYear === 10) {
    setText('rule', annualRmd
      ? 'Annual RMDs apply in years 1–9. Empty the account by December 31 of year 10.'
      : 'No annual RMDs apply in years 1–9. Empty the account by December 31 of year 10.');
    setText('warning-title', 'Waiting can concentrate the tax bill.');
    const payout = minimum.rows[9];
    setText('warning-text', `The minimum-only plan projects a year-10 withdrawal of ${currency(payout.withdrawal)} with ${currency(payout.tax)} in additional federal income tax. A missed payout can also trigger excise tax.`);
  } else {
    setText('rule', deadlineYear === null
      ? 'This stretch scenario has annual life-expectancy RMDs and no mandatory year-10 payout.'
      : `Annual life-expectancy RMDs continue. Empty the account by December 31 of year ${deadlineYear}, the tenth year after reaching age 21.`);
    setText('warning-title', 'Missing an annual RMD can be costly.');
    setText('warning-text', 'The standard federal excise tax is 25% of the shortfall. Check your actual prior December 31 balance and distribution deadline each year.');
  }

  byId('roth-note').hidden = !roth;
  setText('minimum-tax', currency(minimum.totalTax));
  setText('level-tax', currency(level.totalTax));
  setText('tax-difference-label', taxSaved <= -0.005
    ? 'Extra tax with level withdrawals'
    : 'Tax saved with level withdrawals');
  setText('tax-difference', currency(Math.abs(taxSaved)));
  setText('target', currency(result.levelTarget));
  setText('balance-note', `Year-10 ending balance is ${currency(minimum.endingBalance)} under minimum-only withdrawals and ${currency(level.endingBalance)} under the level strategy.`);
  setText('standard', currency(penalty.standard));
  setText('corrected', currency(penalty.corrected));
  setText('waiver', currency(penalty.fullWaiver));
  renderSchedule(result);
}

function update() {
  const accountType = byId('accountType').value;
  const beneficiaryType = byId('beneficiaryType').value;
  const ownerTiming = byId('ownerTiming').value;
  const roth = accountType === 'roth_ira';
  const afterRbd = !roth && ownerTiming === 'on_or_after_rbd';
  byId('edb-field').hidden = beneficiaryType !== 'edb_stretch';
  byId('timing-field').hidden = roth;
  byId('owner-age-field').hidden = !afterRbd;

  try {
    renderResults(simulateInheritedIra({
      accountType, beneficiaryType, ownerTiming, edbType: byId('edbType').value,
      balance: numeric('balance'), age: numeric('age'),
      ownerAgeAtDeath: afterRbd ? numeric('ownerAgeAtDeath') : undefined,
      annualReturn: numeric('annualReturn'),
      otherTaxableIncome: numeric('otherTaxableIncome'),
      filingStatus: byId('filingStatus').value, shortfall: numeric('shortfall', true),
    }), roth);
    byId('error').hidden = true;
    byId('results').hidden = false;
    byId('penalty-results').hidden = false;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    setText('error', error.message);
    byId('error').hidden = false;
    byId('results').hidden = true;
    byId('penalty-results').hidden = true;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
