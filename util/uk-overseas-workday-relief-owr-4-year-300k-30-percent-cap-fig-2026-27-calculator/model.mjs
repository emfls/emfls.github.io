const PERSONAL_ALLOWANCE = 12570;
const CGT_EXEMPTION = 3000;
const BASIC_LIMIT = 37700;
const ADDITIONAL_THRESHOLD = 125140;
const MAX_AMOUNT = 1_000_000_000;

export function personalAllowance(adjustedNetIncome) {
  const reduction = Math.floor(Math.max(0, adjustedNetIncome - 100000) / 2);
  return Math.max(0, PERSONAL_ALLOWANCE - reduction);
}

const pennies = (amount) => Math.round(amount * 100);

export function incomeTax(taxableIncome) {
  const basic = Math.min(taxableIncome, BASIC_LIMIT);
  const higher = Math.max(0, Math.min(taxableIncome, ADDITIONAL_THRESHOLD) - BASIC_LIMIT);
  const additional = Math.max(0, taxableIncome - ADDITIONAL_THRESHOLD);
  // The HMRC calculation rounds each band's tax down to a penny.
  const bandPennies = (amount, rate) => (
    Math.floor(amount * rate + Number.EPSILON * taxableIncome * rate)
  );
  return (bandPennies(basic, 20) + bandPennies(higher, 40) + bandPennies(additional, 45)) / 100;
}

export function capitalGainsTax(gains, taxableIncome, exemption) {
  const taxableGains = Math.max(0, gains - exemption);
  const basic = Math.min(taxableGains, Math.max(0, BASIC_LIMIT - taxableIncome));
  return pennies(basic * 0.18 + (taxableGains - basic) * 0.24) / 100;
}

function scenario(income, gains, allowance, exemption) {
  const taxableIncome = Math.max(0, income - allowance);
  const incomeTaxDue = incomeTax(taxableIncome);
  const cgtDue = capitalGainsTax(gains, taxableIncome, exemption);
  const totalPennies = pennies(incomeTaxDue) + pennies(cgtDue);
  return { allowance, exemption, taxableIncome, incomeTaxDue, cgtDue, totalTax: totalPennies / 100 };
}

export function calculateOWR({
  qualifyingEmploymentIncome, otherIncome = 0, ukGains = 0,
  overseasWorkdays, totalWorkdays, eligible,
}) {
  for (const amount of [qualifyingEmploymentIncome, otherIncome, ukGains]) {
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
      throw new RangeError('Enter amounts from £0 to £1 billion.');
    }
  }
  if (!Number.isInteger(totalWorkdays) || totalWorkdays < 1 || totalWorkdays > 366) {
    throw new RangeError('Enter 1 to 366 total workdays.');
  }
  if (!Number.isInteger(overseasWorkdays) || overseasWorkdays < 0 || overseasWorkdays > totalWorkdays) {
    throw new RangeError('Enter whole overseas workdays between zero and the total workdays.');
  }
  if (typeof eligible !== 'boolean') {
    throw new TypeError('Confirm your eligibility to compare the election.');
  }

  const income = qualifyingEmploymentIncome + otherIncome;
  const apportionedEarnings = (days) => qualifyingEmploymentIncome * (days / totalWorkdays);
  const rawOverseasEarnings = apportionedEarnings(overseasWorkdays);
  const statutoryCap = Math.min(0.30 * qualifyingEmploymentIncome, 300000);
  const claimableOWR = eligible ? Math.min(rawOverseasEarnings, statutoryCap) : 0;
  let capBindingReason = 'NONE';
  if (eligible && rawOverseasEarnings > 0 && rawOverseasEarnings >= statutoryCap) {
    capBindingReason = qualifyingEmploymentIncome > 1_000_000 ? '300K_CAP' : '30_PERCENT_CAP';
  }

  const noElection = scenario(income, ukGains, personalAllowance(income), CGT_EXEMPTION);
  const electionFor = (relief) => scenario(income - relief, ukGains, 0, 0);
  const election = eligible ? electionFor(claimableOWR) : null;
  const savingsPennies = election ? pennies(noElection.totalTax) - pennies(election.totalTax) : null;
  const netTaxSavings = election ? savingsPennies / 100 : null;

  let minimumOverseasWorkdays = null;
  if (eligible && electionFor(statutoryCap).totalTax < noElection.totalTax) {
    // Liability falls monotonically as overseas days increase, up to the cap.
    let lower = 0;
    let upper = totalWorkdays;
    while (upper - lower > 1) {
      const middle = Math.floor((lower + upper) / 2);
      const relief = Math.min(apportionedEarnings(middle), statutoryCap);
      if (electionFor(relief).totalTax < noElection.totalTax) upper = middle;
      else lower = middle;
    }
    minimumOverseasWorkdays = upper;
  }

  return {
    rawOverseasEarnings, statutoryCap, claimableOWR, capBindingReason,
    noElection, election, netTaxSavings, minimumOverseasWorkdays,
    fourYearSavings: election ? savingsPennies * 4 / 100 : null,
    verdict: netTaxSavings > 0 ? 'CLAIM OWR' : 'DO NOT CLAIM',
  };
}
