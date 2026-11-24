import { compare } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('tax-form');
const results = byId('results');
const summary = byId('summary');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dollars = value => money.format(Math.abs(value) < 0.005 ? 0 : value);

function personFields(title) {
  const fields = byId('person-template').content.firstElementChild.cloneNode(true);
  fields.querySelector('legend').textContent = title;
  byId('people').append(fields);
  return fields;
}

const taxpayer = personFields('Taxpayer');
const spouse = personFields('Spouse');
taxpayer.querySelector('[name="foreignWages"]').value = '145000';
taxpayer.querySelector('[name="test"]').value = 'physical';
taxpayer.querySelector('[name="housingExpenses"]').value = '34000';

function readPerson(fields) {
  const values = {};
  for (const control of fields.querySelectorAll('input, select')) {
    if (control.closest('[hidden]') || control.value === '') continue;
    values[control.name] = control.type === 'checkbox' ? control.checked
      : control.type === 'number' ? control.valueAsNumber : control.value;
  }
  return values;
}

function number(id) {
  const field = byId(id);
  return field.value === '' ? 0 : field.valueAsNumber;
}

function update() {
  const joint = byId('status').value === 'joint';
  spouse.hidden = !joint;
  byId('payroll-field').hidden = number('children') < 3;
  for (const person of [taxpayer, spouse]) {
    const test = person.querySelector('[name="test"]').value;
    person.querySelector('[data-eligibility]').hidden = test === 'none';
    person.querySelector('[data-presence]').hidden = test !== 'physical';
  }

  try {
    let invalidField;
    for (const field of form.querySelectorAll('input[type="number"]')) {
      const invalid = !field.closest('[hidden]') && !field.validity.valid;
      if (invalid) {
        field.setAttribute('aria-invalid', 'true');
        invalidField ??= field;
      } else {
        field.removeAttribute('aria-invalid');
      }
    }
    if (invalidField) {
      const label = invalidField.labels[0].firstChild.textContent.trim();
      throw new RangeError(`${label}: ${invalidField.validationMessage}`);
    }

    const estimate = compare({
      status: byId('status').value,
      taxpayer: readPerson(taxpayer),
      spouse: joint ? readPerson(spouse) : undefined,
      usWages: number('us-wages'),
      otherIncome: number('other-income'),
      foreignTax: number('foreign-tax'),
      children: number('children'),
      payrollActc: byId('payroll-field').hidden ? 0 : number('payroll-actc'),
    });
    render(estimate, joint);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    results.hidden = true;
    summary.className = 'error';
    summary.textContent = error.message;
  }
}

function render({ exclusions, deduction, feie, ftc, difference }, joint) {
  const sum = key => exclusions.reduce((total, person) => total + person[key], 0);
  const rows = [
    ['Net U.S. federal income tax', feie?.netTax, ftc.netTax],
    ['Prorated FEIE ceiling', feie && sum('feieLimit'), 0],
    ['FEIE used', feie && sum('feie'), 0],
    ['Housing exclusion used', feie && sum('housingExclusion'), 0],
    ['Standard deduction', feie && deduction, deduction],
    ['Taxable income', feie?.taxableIncome, ftc.taxableIncome],
    ['Federal tax before credits', feie?.incomeTax, ftc.incomeTax],
    ['Form 1116 credit limit', feie?.ftcLimit, ftc.ftcLimit],
    ['Foreign tax credit used', feie?.ftc, ftc.ftc],
    ['Foreign tax disallowed on excluded wages', feie?.disallowedTax, 0],
    ['Excess FTC for other years', feie?.excessFtc, ftc.excessFtc],
    ['Nonrefundable Child Tax Credit', feie?.childCredit, ftc.childCredit],
    ['Refundable Additional Child Tax Credit', feie?.actc, ftc.actc],
    ['Roth IRA modified AGI', feie?.roth.magi, ftc.roth.magi],
    ['IRA-eligible compensation', feie?.roth.compensation, ftc.roth.compensation],
    [joint ? 'Combined Roth IRA room' : 'Roth IRA contribution room', feie?.roth.combined, ftc.roth.combined],
  ];
  if (joint) {
    rows.push(
      ['Taxpayer Roth IRA room, up to', feie?.roth.limits[0], ftc.roth.limits[0]],
      ['Spouse Roth IRA room, up to', feie?.roth.limits[1], ftc.roth.limits[1]],
    );
  }

  const table = document.createDocumentFragment();
  for (const [index, [label, a, b]] of rows.entries()) {
    const row = document.createElement('tr');
    if (index === 0) row.className = 'net-row';
    const header = document.createElement('th');
    header.scope = 'row';
    header.textContent = label;
    row.append(header);
    for (const value of [a, b]) {
      row.insertCell().textContent = value == null ? '—' : dollars(value);
    }
    table.append(row);
  }
  byId('comparison-rows').replaceChildren(table);
  byId('eligibility-detail').textContent = feie ? exclusions.map((person, i) => {
    const name = i === 0 ? 'Taxpayer' : 'Spouse';
    if (!person.eligible) return `${name} did not qualify with the inputs entered.`;
    return `${name} has ${person.days} qualifying days, a ${dollars(person.housingBase)} housing base and a ${dollars(person.housingLimit)} housing expense cap.`;
  }).join(' ') : '';

  summary.className = 'result';
  if (!feie) {
    summary.textContent = 'Form 2555 is unavailable with these inputs. The Form 1116 estimate is shown below.';
  } else if (Math.abs(difference) < 0.005) {
    summary.textContent = 'Both options have the same estimated net U.S. federal income tax.';
  } else {
    const lower = difference > 0 ? 'Form 1116 only' : 'Form 2555 with eligible FTC';
    summary.textContent = `${lower} is lower by ${dollars(Math.abs(difference))} in estimated 2026 U.S. federal income tax.`;
  }
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
form.hidden = false;
update();
