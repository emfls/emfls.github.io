import { estimateBenefit, estimateReemployment, RULES } from './model.mjs';

const form = document.getElementById('calculator');
const fields = form.elements;
const moneyFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const money = (value) => moneyFormat.format(value) + '원';
const difference = (value) => (value > 0 ? '+' : '') + money(value);
const element = (id) => document.getElementById(id);
const write = (id, value) => { element(id).textContent = value; };

function readNumber(field, { min = 0, max, whole = true }) {
  const text = field.value.trim();
  const format = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
  const value = Number(text.replaceAll(',', ''));
  const valid = format.test(text) && Number.isFinite(value) && value >= min && value <= max &&
    (!whole || Number.isSafeInteger(value));
  field.setAttribute('aria-invalid', String(!valid));
  return valid ? value : null;
}

const labels = { floor: '하한액 적용', cap: '상한액 적용', none: '평균임금 60% 적용' };

function update() {
  const averageWage = readNumber(fields.wage, { min: 0.01, max: Number.MAX_SAFE_INTEGER, whole: false });
  const age = readNumber(fields.age, { max: 120 });
  const insuredMonths = readNumber(fields.insuredMonths, { max: 1440 });
  const hours = Number(fields.hours.value);
  const ageValid = age !== null;
  const seniorControl = element('senior-control');
  seniorControl.hidden = !ageValid || age < 65;
  fields.seniorException.disabled = seniorControl.hidden;

  const canEstimate = averageWage !== null && ageValid && insuredMonths !== null;
  element('benefit-results').hidden = !canEstimate;
  element('job-results').hidden = true;
  write('benefit-error', canEstimate ? '' : '1일 평균임금, 만 나이, 가입 개월 수의 입력값을 확인해 주세요.');
  write('job-status', '');
  if (!canEstimate) return;

  const result = estimateBenefit({ averageWage, age, insuredMonths, hours, disabled: fields.disabled.checked });
  write('daily', money(result.daily.amount));
  write('limit', labels[result.daily.limit]);
  write('duration', result.days + '일');
  write('month-28', money(result.month28));
  write('month-30', money(result.month30));
  write('total', money(result.total));
  write('increase-daily', difference(result.increaseDaily));
  write('increase-30', difference(result.increase30));
  write('increase-total', difference(result.increaseTotal));
  write('chart-old', money(result.previous));
  write('chart-new', money(result.daily.amount));
  element('bar-old').setAttribute('width', 300 * result.previous / RULES[2026].dailyCap);
  element('bar-new').setAttribute('width', 300 * result.daily.amount / RULES[2026].dailyCap);
  write('paid-help', '재취업 전날까지 지급받은 구직급여 일수 (0~' + result.days + '일).');

  const paidDays = readNumber(fields.paidDays, { max: result.days });
  const elapsedDays = readNumber(fields.elapsedDays, { max: Number.MAX_SAFE_INTEGER });
  const employmentMonths = readNumber(fields.employmentMonths, { max: Number.MAX_SAFE_INTEGER });
  if ([paidDays, elapsedDays, employmentMonths].includes(null)) {
    write('job-status', '수당을 계산하려면 지급받은 일수, 신고 후 경과일, 계속 고용 개월 수를 확인해 주세요.');
    return;
  }

  const scenario = estimateReemployment({
    daily: result.daily.amount, days: result.days, paidDays, elapsedDays, employmentMonths,
    seniorException: !fields.seniorException.disabled && fields.seniorException.checked,
  });
  element('job-results').hidden = false;
  write('remaining', scenario.remaining + '일');
  write('minimum-remaining', scenario.minimumRemaining + '일');
  write('reemployment', money(scenario.amount));

  const unmet = [];
  if (!scenario.meetsTiming) unmet.push('실업 신고일로부터 15일 이상');
  if (!scenario.meetsRemaining) unmet.push('소정급여일수의 절반 이상 남김');
  if (!scenario.meetsEmployment) unmet.push('계속 고용 ' + scenario.requiredMonths + '개월');
  write('job-status', unmet.length
    ? '입력 조건 미충족 (' + unmet.join(', ') + ')'
    : '입력 조건 충족. 실제 지급 여부는 고용센터에서 심사합니다.');
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
