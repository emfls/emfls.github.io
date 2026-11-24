import { compareWages, legalLeaveDays } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('calculator');
const results = byId('results');
const error = byId('input-error');
const legalDaysBadge = byId('legal-days');
const useLegalDays = byId('use-legal-days');
const fields = [...form.querySelectorAll('input')];
const rows = [...results.querySelectorAll('[data-metric]')];
const won = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const formatWon = (value) => `${won.format(value)}원`;
const formatIncrease = (value) => `${Math.round(value) > 0 ? '+' : ''}${formatWon(value)}`;

function render() {
  const years = byId('years');
  const attendance = byId('attendance');
  const months = byId('perfectMonths');
  attendance.disabled = years.valueAsNumber === 0;
  byId('attendance-field').hidden = attendance.disabled;
  months.disabled = !(
    attendance.disabled || (attendance.validity.valid && attendance.valueAsNumber < 80)
  );
  byId('months-field').hidden = months.disabled;
  months.max = attendance.disabled ? '11' : '12';

  const values = {};
  const invalid = fields.filter((field) => {
    values[field.id] = field.disabled ? 0 : field.valueAsNumber;
    const bad = !field.disabled && (
      !field.validity.valid || field.valueAsNumber > Number.MAX_SAFE_INTEGER
    );
    field.setAttribute('aria-invalid', String(bad));
    return bad;
  });

  const leaveInputs = [years, attendance, months];
  if (invalid.some((field) => leaveInputs.includes(field))) {
    legalDaysBadge.textContent = '법정 발생 연차 —';
    useLegalDays.disabled = true;
  } else {
    const days = legalLeaveDays(values);
    legalDaysBadge.textContent = `법정 발생 연차 ${days}일`;
    useLegalDays.dataset.days = String(days);
    useLegalDays.disabled = false;
  }

  results.hidden = invalid.length > 0;
  error.hidden = !results.hidden;
  if (results.hidden) {
    error.textContent = '표시된 입력칸에 허용 범위의 숫자를 입력하면 비교 결과가 표시됩니다.';
    return;
  }

  const { previous, current, increase, belowMinimum } = compareWages(values);
  for (const row of rows) {
    const key = row.dataset.metric;
    row.cells[1].textContent = formatWon(previous[key]);
    row.cells[2].textContent = formatWon(current[key]);
    row.cells[3].textContent = formatIncrease(increase[key]);
  }
  byId('leave-increase').textContent = formatIncrease(increase.leave);
  byId('overtime-increase').textContent = `${formatIncrease(increase.overtime)}/시간`;
  byId('minimum-warning').hidden = !belowMinimum;

  const chartMax = current.leave || 1;
  for (const [key, data] of [['previous', previous], ['current', current]]) {
    byId(`${key}-bar`).setAttribute('width', String((data.leave / chartMax) * 100));
    byId(`${key}-chart-value`).textContent = formatWon(data.leave);
  }
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
useLegalDays.addEventListener('click', () => {
  byId('unusedDays').value = useLegalDays.dataset.days;
  render();
});
render();
