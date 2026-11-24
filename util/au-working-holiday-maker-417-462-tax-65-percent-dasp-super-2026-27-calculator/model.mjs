const upperBrackets = [[45000, 0.30], [135000, 0.37], [190000, 0.45]];
const whmBrackets = [[0, 0.15], ...upperBrackets];
const residentBrackets = [[18200, 0.15], ...upperBrackets];
const foreignBrackets = [[0, 0.30], ...upperBrackets.slice(1)];
const superContributionBase = 270830;

export const ndaCountries = Object.freeze([
  'Chile', 'Finland', 'Germany', 'Israel', 'Japan', 'Norway', 'Turkey', 'United Kingdom',
]);

function bracketTax(income, brackets) {
  return brackets.reduce((tax, [floor, rate], index) => {
    const ceiling = brackets[index + 1]?.[0] ?? Infinity;
    return tax + Math.max(0, Math.min(income, ceiling) - floor) * rate;
  }, 0);
}

export function estimate({
  wages, weeks = 52, existingSuper = 0, payroll = 'registered', country = '',
  fullYearResident = false,
} = {}) {
  if (!Number.isFinite(wages) || wages < 0 || wages > 1e9 ||
      !Number.isFinite(existingSuper) || existingSuper < 0 || existingSuper > 1e9 ||
      !Number.isFinite(weeks) || weeks < 1 || weeks > 52 ||
      !['registered', 'unregistered', 'no-tfn'].includes(payroll)) {
    throw new RangeError('Enter valid wages, super, working weeks and payroll status.');
  }

  const whmTax = bracketTax(wages, whmBrackets);
  const residentTax = bracketTax(wages, residentBrackets);
  const ndaEligible = fullYearResident === true && ndaCountries.includes(country);
  const estimatedTax = ndaEligible ? Math.min(whmTax, residentTax) : whmTax;
  // Schedule 15 changes the rate on the first pay after cumulative pay crosses a band.
  const weeklyPay = wages / weeks;
  const registeredWithheld = wages === 0 ? 0 : bracketTax(wages, [
    whmBrackets[0],
    ...upperBrackets.map(([floor, rate]) => [
      Math.min(wages, Math.ceil((floor + 1) / weeklyPay) * weeklyPay), rate,
    ]),
  ]);
  // Approximate the foreign-resident pay-period schedule using even weekly pay.
  const workYearFraction = weeks / 52;
  const unregisteredWithheld = bracketTax(wages / workYearFraction, foreignBrackets) * workYearFraction;
  const withheld = {
    registered: registeredWithheld,
    unregistered: unregisteredWithheld,
    'no-tfn': wages * 0.45,
  }[payroll];

  const grossSuper = Math.min(wages, superContributionBase) * 0.12;
  const contributionsTax = grossSuper * 0.15;
  const newSuper = grossSuper - contributionsTax;
  const superBalance = newSuper + existingSuper;
  const whmDaspTax = superBalance * 0.65;
  const ordinaryDaspTax = superBalance * 0.35;

  return {
    whmTax,
    whmNet: wages - whmTax,
    weeklyWhmTax: whmTax / weeks,
    weeklyWhmNet: (wages - whmTax) / weeks,
    residentTax,
    ndaEligible,
    ndaSavings: whmTax - estimatedTax,
    estimatedTax,
    net: wages - estimatedTax,
    withheld,
    payrollNet: wages - withheld,
    weeklyPayrollNet: (wages - withheld) / weeks,
    settlement: withheld - estimatedTax,
    unregisteredWithheld,
    unregisteredOverpayment: Math.max(0, unregisteredWithheld - whmTax),
    grossSuper,
    contributionsTax,
    newSuper,
    superBalance,
    whmDaspTax,
    whmDaspNet: superBalance - whmDaspTax,
    ordinaryDaspNet: superBalance - ordinaryDaspTax,
    extraDaspTax: whmDaspTax - ordinaryDaspTax,
  };
}
