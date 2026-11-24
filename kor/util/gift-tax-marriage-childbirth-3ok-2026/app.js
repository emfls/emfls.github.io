import { calculateGiftTax, compareCouple, parseManwon, statutoryDeadline } from './model.mjs';

const element = (id) => document.getElementById(id);
const formatter = new Intl.NumberFormat('ko-KR');
const won = (amount) => formatter.format(amount) + '원';

function show(id, text) {
  element(id).textContent = text;
}

function readAmount(id, label, optional = false) {
  const value = element(id).value;
  if (optional && !value.trim()) return 0;
  const amount = parseManwon(value);
  if (amount === null) {
    throw new RangeError(label + '을(를) 만 원 단위 숫자로 입력해 주세요. 소수점 아래 네 자리까지 입력할 수 있습니다.');
  }
  return amount;
}

function updateComparison(timely) {
  const { split, single, difference } = compareCouple(timely);
  show('split-total', won(split));
  show('single-total', won(single));
  show('difference', won(difference));
  const max = Math.max(split, single, 1);
  element('split-bar').setAttribute('width', 1000 * split / max);
  element('single-bar').setAttribute('width', 1000 * single / max);
}

const resultRows = {
  aggregated: 'aggregated',
  basicDeduction: 'basic-deduction',
  specialDeduction: 'special-deduction',
  taxBase: 'tax-base',
  tax: 'tax',
  priorCredit: 'prior-credit',
  filingCredit: 'filing-credit',
};

function update() {
  const relation = element('relation').value;
  const grandchild = ['adultGrandchild', 'minorGrandchild'].includes(relation);
  const ancestor = grandchild || ['adultChild', 'minorChild'].includes(relation);
  const event = ancestor ? element('event').value : 'none';
  const timely = element('timely').checked;
  const skipExempt = grandchild && element('skip-exempt').checked;
  const eventDate = element('event-date');
  const giftDate = element('gift-date');

  element('event-field').hidden = !ancestor;
  element('event-date-field').hidden = event === 'none';
  element('special-used-field').hidden = !ancestor;
  element('skip-field').hidden = !grandchild;
  element('late-warning').hidden = timely;
  show('event-date-label', event === 'birth' ? '자녀의 출생일 또는 입양일' : '혼인신고일 또는 예정일');
  updateComparison(timely);

  const priorEntry = parseManwon(element('prior-gift').value);
  const hasPrior = priorEntry !== null && priorEntry >= 10_000_000;
  element('prior-base-field').hidden = !hasPrior;
  element('prior-tax-field').hidden = !hasPrior;
  element('prior-surcharge-field').hidden = !hasPrior || !grandchild || skipExempt;

  try {
    if (!giftDate.value || !giftDate.validity.valid) throw new RangeError('2026년 증여일을 입력해 주세요.');
    if (event !== 'none' && (!eventDate.value || !eventDate.validity.valid)) {
      throw new RangeError('혼인신고일 또는 출생·입양일을 확인해 주세요.');
    }

    const result = calculateGiftTax({
      gift: readAmount('gift', '이번에 받는 금액'),
      relation,
      event,
      giftDate: giftDate.value,
      eventDate: eventDate.value,
      timely,
      skipExempt,
      priorGift: readAmount('prior-gift', '과거 증여재산가액', true),
      basicUsed: readAmount('basic-used', '사용한 기본공제액', true),
      specialUsed: ancestor ? readAmount('special-used', '사용한 혼인·출산 공제액', true) : 0,
      priorBase: hasPrior ? readAmount('prior-base', '과거 과세표준') : undefined,
      priorTax: hasPrior ? readAmount('prior-tax', '과거 산출세액') : 0,
      priorSurcharge: hasPrior && grandchild && !skipExempt
        ? readAmount('prior-surcharge', '과거 세대생략 할증액')
        : 0,
    });

    show('error', '');
    show('due', won(result.due));
    show('bracket', result.rate ? result.rate + '% / ' + won(result.bracketDeduction) : '과세최저한 미만');
    show('surcharge', result.surchargeRate ? won(result.surcharge) + ' (' + result.surchargeRate + '%)' : won(0));
    for (const [key, id] of Object.entries(resultRows)) show(id, won(result[key]));

    if (event === 'none') {
      show('eligibility', '혼인·출산 공제 적용 대상이 아닙니다.');
    } else if (!result.specialEligible) {
      show('eligibility', '증여일이 혼인·출산 공제 기간에 해당하지 않습니다.');
    } else if (event === 'marriage' && giftDate.value < eventDate.value) {
      show('eligibility', '예정일 기준으로 계산했습니다. 증여일부터 2년 이내에 혼인신고를 해야 합니다.');
    } else {
      show('eligibility', '입력한 날짜가 혼인·출산 공제 기간에 해당합니다.');
    }

    show('deadline', '신고기한 기준일 ' + statutoryDeadline(giftDate.value) + ' · 공휴일 등 기한 연장 반영 전');
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    show('error', error.message);
    show('due', '입력 확인 필요');
    for (const id of [...Object.values(resultRows), 'bracket', 'surcharge']) show(id, '—');
    show('eligibility', '');
    show('deadline', '');
  }
}

element('gift-form').addEventListener('input', update);
element('gift-form').addEventListener('submit', (event) => event.preventDefault());
update();
