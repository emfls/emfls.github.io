import { calculateQbi } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('qbi-form');
const error = byId('input-error');
const content = byId('result-content');
const summary = byId('result-summary');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percentage = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
const statusLabels = {
  BELOW_THRESHOLD_FULL_20: 'At or below the threshold',
  IN_EXPANDED_OBBBA_PHASEIN: 'In the expanded phase-in range',
  ABOVE_CAP: 'Above the phase-in range',
};

function salaryHint(result, w2Wages, isSstb) {
  const reasonableComp = 'Use reasonable compensation for shareholder-employees and compare the payroll-tax and QBI effects together.';
  if (result.phaseInRatio === 0) return 'Your income is within the range where the wage limit does not apply. ' + reasonableComp;
  if (isSstb && result.applicablePct === 0) return 'Increasing wages cannot restore SSTB eligibility at this income. ' + reasonableComp;
  if (result.wageReduction === 0) return 'The wage limit is not reducing your deduction at these inputs. ' + reasonableComp;
  if (result.wageBenchmark === null) {
    return 'A higher wage cap alone cannot remove the taxable-income cap, the active minimum, or the SSTB reduction. ' + reasonableComp;
  }
  const benchmark = Math.ceil(result.wageBenchmark * 100) / 100;
  const gap = Math.max(0, benchmark - w2Wages);
  return 'At fixed QBI and UBIA, ' + money.format(benchmark) + ' in allocable business W-2 wages ('
    + money.format(gap) + ' more) would clear the wage test. Changing owner pay can also change QBI. '
    + reasonableComp;
}

function render() {
  const input = {
    filingStatus: byId('filing-status').value,
    taxableIncome: byId('taxable-income').valueAsNumber,
    qbi: byId('qbi').valueAsNumber,
    netCapitalGains: byId('net-capital-gains').valueAsNumber,
    w2Wages: byId('w2-wages').valueAsNumber,
    ubia: byId('ubia').valueAsNumber,
    marginalRate: byId('marginal-rate').valueAsNumber,
    isSstb: byId('business-type').value === 'sstb',
    materiallyParticipates: byId('participation').value === 'yes',
  };

  let result;
  try {
    result = calculateQbi(input);
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    content.hidden = true;
    summary.textContent = '';
    error.textContent = problem.message;
    error.hidden = false;
    return;
  }

  const amounts = {
    deduction: result.deduction,
    'extra-deduction': result.extraDeduction,
    'tax-saved': result.estimatedTaxSaved,
    tentative: result.tentativeDeduction,
    'wage-cap': result.wageUbiaCap,
    'wage-reduction': result.wageReduction,
    'income-cap': result.incomeCap,
    'regular-deduction': result.regularDeduction,
    'floor-added': result.deduction - result.regularDeduction,
    'legacy-deduction': result.legacyWindowDeduction,
  };
  for (const [id, amount] of Object.entries(amounts)) byId(id).textContent = money.format(amount);

  const status = statusLabels[result.status];
  byId('status-label').textContent = status;
  byId('status-code').textContent = result.status;
  byId('window-detail').textContent = '2026 threshold ' + money.format(result.threshold)
    + ', upper limit ' + money.format(result.upperCap)
    + ', wage-limit phase-in ' + percentage.format(result.phaseInRatio)
    + (input.isSstb ? ', SSTB applicable percentage ' + percentage.format(result.applicablePct) : '') + '.';
  byId('salary-hint').textContent = salaryHint(result, input.w2Wages, input.isSstb);
  error.hidden = true;
  content.hidden = false;
  summary.textContent = 'Estimated deduction ' + money.format(result.deduction) + '. ' + status + '.';
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();
