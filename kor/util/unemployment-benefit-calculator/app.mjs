import {calculateUnemployment} from './model.mjs';

export function summarize(form) {
  const result = calculateUnemployment({
    year: Number(form.get('year')),
    dailyWage: Number(form.get('dailyWage')),
    hours: Number(form.get('hours')),
    age: Number(form.get('age')),
    insuredMonths: Number(form.get('insuredMonths')),
    disabled: form.has('disabled'),
  });
  const won = value => value.toLocaleString('ko-KR') + '원';
  return [
    ['예상 총 구직급여', won(result.total)],
    ['1일 지급액', won(result.daily)], ['소정급여일수', result.days + '일'],
    ['30일 환산액', won(result.thirtyDays)],
    ['적용 하한액', won(result.lower)], ['적용 상한액', won(result.upper)],
    ['이직 연도 기준 최저시급', won(result.hourlyWage)],
    ...(form.get('year') === '2027' ? [['2027년 적용 기준', '현행 시행령 유지 가정']] : []),
  ];
}

const form = document.querySelector('#calculator');
const result = document.querySelector('#result');
form.addEventListener('input', () => { result.replaceChildren(); });
form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const rows = summarize(new FormData(form));
    const list = document.createElement('dl');
    for (const [label, value] of rows) {
      const term = document.createElement('dt');
      const definition = document.createElement('dd');
      term.textContent = label;
      definition.textContent = value;
      list.append(term, definition);
    }
    result.replaceChildren(list);
  } catch (error) {
    result.textContent = error instanceof RangeError ? error.message :
      "입력값을 확인하고 다시 계산하세요.";
  }
});
