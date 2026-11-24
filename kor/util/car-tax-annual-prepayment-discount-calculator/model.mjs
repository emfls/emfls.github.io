const floor = Math.floor;

export function vehicleTax({electric = false, cc = 0, age = 1}) {
  if (!electric && (!Number.isSafeInteger(cc) || cc < 1 || cc > 10000 ||
      !Number.isSafeInteger(age) || age < 1 || age > 100)) {
    throw new RangeError('배기량 및 차령을 허용 범위의 정수로 입력하세요.');
  }
  const base = electric ? 100000 : cc * (cc <= 1000 ? 80 : cc <= 1600 ? 140 : 200);
  const ageDiscount = electric ? 0 : Math.min(50, Math.max(0, (age - 2) * 5));
  const vehicle = floor(base * (100 - ageDiscount) / 100);
  const education = floor(vehicle * 30 / 100);
  const annual = vehicle + education;
  const prepayments = [
    [1, 334, 365, 1], [3, 275, 365, 1], [6, 184, 184, 2], [9, 92, 184, 2],
  ].map(([month, days, denominator, baseDivisor]) => {
    const discount = floor(annual * days * 5 / (denominator * baseDivisor * 100));
    return {month, days, denominator, discount, annualNet: annual - discount};
  });
  return {base, ageDiscount, vehicle, education, annual, prepayments};
}
