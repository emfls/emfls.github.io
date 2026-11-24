import { calculateRDSP, calculateRepayment } from './model.mjs';

const element = (id) => document.getElementById(id);
const currency = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', currencyDisplay: 'code',
});
const money = (amount) => currency.format(amount);
const write = (id, text) => { element(id).textContent = text; };

function bindCalculator(formId, resultsId, errorId, calculate, render) {
  const form = element(formId);
  function update() {
    const values = {};
    for (const field of form.elements) {
      if (field.type === 'number') {
        if (!field.validity.valid) {
          const label = field.labels[0].textContent;
          element(resultsId).hidden = true;
          write(errorId, `${label}. ${field.validationMessage}`);
          return;
        }
        values[field.id] = field.valueAsNumber;
      } else if (field.type === 'select-one') {
        values[field.id] = field.value === 'yes';
      }
    }

    try {
      render(calculate(values), values);
      element(resultsId).hidden = false;
      write(errorId, '');
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      element(resultsId).hidden = true;
      write(errorId, error.message);
    }
  }

  form.addEventListener('input', update);
  form.addEventListener('submit', (event) => event.preventDefault());
  update();
}

const assistance = (grant, bond) => `${money(grant)} grant · ${money(bond)} bond`;

bindCalculator('rdsp-form', 'rdsp-results', 'rdsp-error', calculateRDSP, (result, values) => {
  write('income-note', values.beneficiaryAge <= 18
    ? 'Use parent or guardian family income through the year the beneficiary turns 18.'
    : 'Use the beneficiary’s family income, including a spouse or common-law partner where applicable.');
  write('annual-total', money(result.annualGrant + result.annualBond));
  write('annual-detail', assistance(result.annualGrant, result.annualBond));
  write('assistance-total', money(result.grant2026 + result.bond2026));
  write('assistance-detail', assistance(result.grant2026, result.bond2026));
  write('optimal-contribution', money(result.optimalContribution));
  write('optimal-detail', `Maximum available grant: ${money(result.maximumGrant2026)}`);
  write('lifetime-total', money(result.lifetimeAssistance));
  write('lifetime-detail', assistance(result.lifetimeGrant, result.lifetimeBond));
  write('projected-balance', result.projectedBalance === null ? 'Past age 60' : money(result.projectedBalance));
  let note = `2026 contribution used in this estimate: ${money(result.contribution2026)}.`;
  if (!values.eligible) {
    note = 'The scenario assumes no new contributions, grants or bonds while eligibility is absent.';
  } else if (!result.canContribute) {
    note = 'Regular contributions end after the year the beneficiary turns 59.';
  } else if (result.contribution2026 < values.contribution) {
    note += ' The lifetime contribution limit reduces the planned amount.';
  }
  if (values.eligible && !result.canReceive) {
    note += ' Grant and bond eligibility ends after the year the beneficiary turns 49.';
  }
  write('contribution-note', note);
});

bindCalculator('withdrawal-form', 'withdrawal-results', 'withdrawal-error', calculateRepayment, (result) => {
  write('repayment', money(result.repayment));
  write('plan-reduction', money(result.planReduction));
});
