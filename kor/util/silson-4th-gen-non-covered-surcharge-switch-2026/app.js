import {
  OLD_PRESETS, TIERS, compareAnnualCosts, compareClaim, estimatePremium, nonCoveredBreakEven,
} from './model.mjs';

const byId = (id) => document.getElementById(id);
const number = (id) => byId(id).valueAsNumber;
const setText = (id, value) => { byId(id).textContent = value; };
const formatter = new Intl.NumberFormat('ko-KR');
const won = (amount) => formatter.format(amount) + '원';
const generation = byId('generation');
const form = byId('calculator');
const exclusions = byId('use-exclusions');
const excludedInput = byId('excluded');
const additionalExempt = byId('additional-exempt');
const rulesRows = document.querySelectorAll('[data-level]');
const svgNS = 'http://www.w3.org/2000/svg';

function svgElement(tag, attrs, text) {
  const element = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

function drawChart(coveredMonthly, riderMonthly, activeLevel) {
  const maximum = estimatePremium(coveredMonthly, riderMonthly, TIERS.at(-1)).monthly;
  const scale = 150 / (maximum || 1);
  const coveredWidth = coveredMonthly * scale;
  const chart = byId('chart-bars');
  const descriptions = [];
  chart.replaceChildren();

  for (const tier of TIERS) {
    const premium = estimatePremium(coveredMonthly, riderMonthly, tier);
    const y = 4 + (tier.level - 1) * 30;
    const current = tier.level === activeLevel;
    const row = svgElement('g', { transform: `translate(0 ${y})` });
    if (current) {
      row.append(svgElement('rect', {
        x: 1, y: 0, width: 318, height: 27, rx: 5, fill: '#edf8f4', stroke: '#147d72',
      }));
    }
    row.append(
      svgElement('text', { x: 8, y: 18, 'font-weight': current ? 750 : 500 }, `${tier.level}등급`),
      svgElement('rect', { x: 52, y: 7, width: coveredWidth, height: 12, fill: '#a7b9b9' }),
      svgElement('rect', {
        x: 52 + coveredWidth, y: 7, width: premium.rider * scale, height: 12,
        fill: tier.level >= 3 ? '#b95727' : '#147d72',
      }),
      svgElement('text', { x: 312, y: 18, 'text-anchor': 'end' }, won(premium.monthly)),
    );
    chart.append(row);
    descriptions.push(`${tier.level}등급 ${won(premium.monthly)}${current ? ' (예상 등급)' : ''}`);
  }
  setText('chart-desc', descriptions.join(', '));
}

function breakEvenText(result) {
  switch (result.kind) {
    case 'point':
      return `연간 비급여 진료비가 약 ${won(result.amount)}일 때 총부담이 같아집니다.`;
    case 'all':
      return '현재 급여 진료비와 갱신 등급에서는 비급여 진료비와 관계없이 총부담이 같습니다.';
    default: {
      const winner = result.savingsAtZero > 0 ? '4세대 가정' : '기존 계약 유지';
      return `비급여 진료비를 0원 이상으로 바꿔도 손익분기점이 없으며 ${winner}의 총부담이 더 낮습니다.`;
    }
  }
}

function render() {
  const useExclusions = exclusions.checked;
  byId('exclusions').hidden = !useExclusions;
  excludedInput.disabled = !useExclusions;
  additionalExempt.disabled = !useExclusions;
  const paid = number('paid');
  excludedInput.max = Number.isFinite(paid) && paid >= 0 ? paid : 0;
  const invalid = form.querySelector('input:invalid');
  byId('input-error').hidden = !invalid;
  byId('results').hidden = Boolean(invalid);
  for (const row of rulesRows) row.removeAttribute('aria-current');
  if (invalid) {
    setText('input-error', `${invalid.labels[0].textContent.trim()} 항목을 확인해 주세요. ${invalid.validationMessage}`);
    return;
  }

  const coveredMonthly = number('covered-monthly');
  const riderMonthly = number('rider-monthly');
  const additional = number('additional');
  const excluded = useExclusions ? number('excluded') : 0;
  const exempt = useExclusions && additionalExempt.checked;
  const claim = compareClaim(paid, additional, excluded, exempt, coveredMonthly, riderMonthly);
  const premium = claim.afterPremium;
  const scenario = {
    oldMonthly: number('old-monthly'),
    oldCoveredRate: number('old-covered-rate'),
    oldRiderRate: number('old-rider-rate'),
    coveredBills: number('covered-bills'),
    riderBills: number('rider-bills'),
    newAnnual: premium.annual,
  };
  const comparison = compareAnnualCosts(scenario);
  const level = claim.after.level;
  const assessed = paid - excluded + (exempt ? 0 : additional);

  setText('tier-badge', `${level}등급`);
  byId('tier-badge').dataset.surcharge = String(level >= 3);
  setText('tier-label', `비급여 특약 ${claim.after.label}`);
  setText('assessed', `추가 청구 반영 후 할인·할증 산정액 ${won(assessed)}`);
  setText('new-monthly', won(premium.monthly));
  setText('new-annual', won(premium.annual));
  document.querySelector(`[data-level="${level}"]`).setAttribute('aria-current', 'true');
  drawChart(coveredMonthly, riderMonthly, level);

  const { savings } = comparison;
  const oldName = `${generation.value}세대 유지`;
  const winner = savings > 0 ? '4세대 가정' : oldName;
  setText('winner', savings === 0
    ? '두 시나리오의 연간 총부담이 같습니다.'
    : `${winner}의 연간 총부담이 ${won(Math.abs(savings))} 더 적습니다.`);
  setText('old-column', oldName);
  setText('old-annual', won(comparison.oldAnnual));
  setText('compare-new-annual', won(premium.annual));
  setText('old-copay', won(comparison.oldCopay));
  setText('new-copay', won(comparison.newCopay));
  setText('old-total', won(comparison.oldTotal));
  setText('new-total', won(comparison.newTotal));
  setText('break-even', breakEvenText(nonCoveredBreakEven(scenario)));

  byId('claim-box').dataset.loss = String(claim.net < 0);
  setText('claim-transition', `${claim.before.level}등급 → ${level}등급 · 추가 보험금 ${won(additional)} · 차기 1년 보험료 증가 ${won(claim.extraPremium)}`);
  if (claim.net < 0) {
    setText('claim-net', `보험료 증가분이 추가 보험금보다 ${won(-claim.net)} 더 큽니다.`);
  } else if (claim.net > 0) {
    setText('claim-net', `보험료 증가분을 빼고 ${won(claim.net)}의 추가 수령 효과가 있습니다.`);
  } else {
    setText('claim-net', '추가 보험금과 차기 1년 보험료 증가분의 차이는 0원입니다.');
  }
}

generation.addEventListener('change', () => {
  const [covered, rider] = OLD_PRESETS[generation.value];
  byId('old-covered-rate').value = covered;
  byId('old-rider-rate').value = rider;
  render();
});
form.addEventListener('input', (event) => {
  if (event.target !== generation) render();
});
form.addEventListener('submit', (event) => event.preventDefault());
render();
