// 2026 ordinary-income schedules: IRS Rev. Proc. 2025-32 §4.01 and §4.15.
const filingRules = {
  single: {
    standardDeduction: 16_100, threshold: 150_000, overtimeCap: 12_500,
    brackets: [12_400, 50_400, 105_700, 201_775, 256_225, 640_600, Infinity]
  },
  hoh: {
    standardDeduction: 24_150, threshold: 150_000, overtimeCap: 12_500,
    brackets: [17_700, 67_450, 105_700, 201_750, 256_200, 640_600, Infinity]
  },
  mfj: {
    standardDeduction: 32_200, threshold: 300_000, overtimeCap: 25_000,
    brackets: [24_800, 100_800, 211_400, 403_550, 512_450, 768_700, Infinity]
  }
};
const rates = [10, 12, 22, 24, 32, 35, 37];
const tipsCap = 25_000;
const socialSecurityCap = 184_500;

const cents = dollars => Math.round(dollars * 100);

// Monetary inputs are dollars to the cent. Hours are accepted to hundredths.
export function overtimePremium(rate, hours) {
  return Math.round(cents(rate) * cents(hours) / 200) / 100;
}

export function phaseoutReduction(magi, threshold, rounding = 'irsDraft') {
  const increments = Math.max(0, cents(magi) - cents(threshold)) / 100_000;
  // Draft 2026 Schedule 1-A lines 13 and 25 count only whole increments.
  const count = rounding === 'roundUp' ? Math.ceil(increments) : Math.floor(increments);
  return count * 100;
}

export function progressiveTax(taxableIncome, filing) {
  const taxable = Math.max(0, cents(taxableIncome));
  let taxHundredthsOfCent = 0;
  let lower = 0;
  for (const [index, cutoff] of filingRules[filing].brackets.entries()) {
    const upper = Math.min(taxable, cents(cutoff));
    taxHundredthsOfCent += (upper - lower) * rates[index];
    if (upper === taxable) break;
    lower = upper;
  }
  return Math.round(taxHundredthsOfCent / 100) / 100;
}

export function calculate({ filing, agi, magi = agi, overtime, tips, rounding = 'irsDraft' }) {
  const { standardDeduction, threshold, overtimeCap } = filingRules[filing];
  const reduction = phaseoutReduction(magi, threshold, rounding);
  const overtimeDeduction = Math.max(0, Math.min(cents(overtime), cents(overtimeCap)) - cents(reduction));
  const tipsDeduction = Math.max(0, Math.min(cents(tips), cents(tipsCap)) - cents(reduction));
  const totalDeduction = overtimeDeduction + tipsDeduction;
  const taxableBefore = Math.max(0, cents(agi) - cents(standardDeduction));
  const taxableAfter = Math.max(0, taxableBefore - totalDeduction);
  const taxBefore = progressiveTax(taxableBefore / 100, filing);
  const taxAfter = progressiveTax(taxableAfter / 100, filing);
  const taxSavings = (cents(taxBefore) - cents(taxAfter)) / 100;
  return {
    standardDeduction, threshold, reduction, magi,
    overtimeDeduction: overtimeDeduction / 100,
    tipsDeduction: tipsDeduction / 100,
    totalDeduction: totalDeduction / 100,
    taxableBefore: taxableBefore / 100, taxableAfter: taxableAfter / 100,
    taxBefore, taxAfter, taxSavings,
    effectiveBefore: agi > 0 ? taxBefore / agi : 0,
    effectiveAfter: agi > 0 ? taxAfter / agi : 0,
    effectiveRateDrop: agi > 0 ? taxSavings / agi : 0
  };
}

export function employeeFica(filing, primary, spouse = { socialSecurity: 0, medicare: 0 }) {
  const joint = filing === 'mfj';
  const workers = joint ? [primary, spouse] : [primary];
  let socialSecurityWages = 0;
  let medicareWages = 0;
  for (const worker of workers) {
    socialSecurityWages += cents(Math.min(socialSecurityCap, worker.socialSecurity));
    medicareWages += cents(worker.medicare);
  }
  const excessMedicare = Math.max(0, medicareWages - cents(joint ? 250_000 : 200_000));
  const socialSecurity = Math.round(socialSecurityWages * 62 / 1000);
  const medicare = Math.round(medicareWages * 145 / 10_000);
  const additionalMedicare = Math.round(excessMedicare * 9 / 1000);
  return {
    socialSecurity: socialSecurity / 100,
    medicare: medicare / 100,
    additionalMedicare: additionalMedicare / 100,
    total: (socialSecurity + medicare + additionalMedicare) / 100
  };
}
