// Rates are marginal basis points. Taxable amounts are kept in cents.
const ontarioBands = [
  [55000, 50], [250000, 100], [400000, 150], [2000000, 200], [Infinity, 250],
];
const torontoBase = [...ontarioBands.slice(0, -1), [3000000, 250]];
const torontoEarly = [
  ...torontoBase, [4000000, 350], [5000000, 450], [10000000, 550],
  [20000000, 650], [Infinity, 750],
];
const torontoLater = [
  ...torontoBase, [4000000, 440], [5000000, 545], [10000000, 650],
  [20000000, 755], [Infinity, 860],
];
const bcBands = [[200000, 100], [2000000, 200], [3000000, 300], [Infinity, 500]];

function toCents(value, min, label) {
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || value < min || value > 1_000_000_000 || cents / 100 !== value) {
    throw new RangeError(`Enter ${label} from ${min} to 1,000,000,000 with up to two decimal places.`);
  }
  return cents;
}

function bandTax(price, bands) {
  let lower = 0;
  let tax = 0;
  for (const [limit, rate] of bands) {
    const upper = Math.min(price, limit * 100);
    tax += (upper - lower) * rate;
    if (upper === price) break;
    lower = upper;
  }
  return Math.round(tax / 10000);
}

function phaseOut(price, start, end) {
  return Math.min(1, Math.max(0, (end * 100 - price) / ((end - start) * 100)));
}

function validateAgreement(agreement) {
  if (agreement === '') return;
  const date = new Date(agreement + 'T00:00:00Z');
  if (typeof agreement !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(agreement)
    || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== agreement) {
    throw new RangeError('Enter a valid builder agreement date.');
  }
}

function registrationFee(value) {
  return 5000 + 500 * Math.ceil(value / 500_000);
}

export function calculate({
  price, jurisdiction, home, agreement = '', buyers,
  federalEligible = false, creditEligible = false, transferEligible = false, bcNewEligible = false,
  toronto = false, torontoPeriod = 'apr-dec', gstAtClosing = false, transferAtClosing = true,
  mortgage = 0,
}) {
  const value = toCents(price, 0.01, 'a home value');
  if (!['on', 'bc', 'ab', 'other'].includes(jurisdiction)
    || !['new', 'renovated', 'resale'].includes(home)
    || ![1, 2].includes(buyers)
    || !['jan-mar', 'apr-dec'].includes(torontoPeriod)) {
    throw new RangeError('Choose a supported location, home type, registration period and buyer count.');
  }
  if (home !== 'resale') validateAgreement(agreement);

  let gstRebate = 0;
  if (home !== 'resale' && federalEligible && agreement >= '2025-03-20' && agreement < '2031-01-01') {
    gstRebate = value <= 100_000_000 ? Math.round(value / 20)
      : Math.round(5_000_000 * phaseOut(value, 1_000_000, 1_500_000));
  }

  let provincialTax = 0;
  let municipalTax = 0;
  let provincialRelief = 0;
  let municipalRelief = 0;
  let titleFee = 0;
  let mortgageFee = 0;
  let bcExemption = null;

  if (jurisdiction === 'on') {
    provincialTax = bandTax(value, ontarioBands);
    if (transferEligible) provincialRelief = Math.min(provincialTax, 400_000);

    if (toronto) {
      municipalTax = bandTax(value, torontoPeriod === 'jan-mar' ? torontoEarly : torontoLater);
      if (transferEligible) municipalRelief = Math.min(municipalTax, 447_500);
    }
  } else if (jurisdiction === 'bc') {
    provincialTax = bandTax(value, bcBands);
    const firstTime = transferEligible
      ? Math.round(Math.min(provincialTax, 800_000) * phaseOut(value, 835_000, 860_000)) : 0;
    const newlyBuilt = home === 'new' && bcNewEligible
      ? Math.round(provincialTax * phaseOut(value, 1_100_000, 1_150_000)) : 0;
    provincialRelief = Math.max(firstTime, newlyBuilt);
    if (provincialRelief) bcExemption = newlyBuilt >= firstTime ? 'new' : 'first-time';
  } else if (jurisdiction === 'ab') {
    const principal = toCents(mortgage, 0, 'a mortgage principal');
    titleFee = registrationFee(value);
    if (principal > 0) mortgageFee = registrationFee(principal);
  }

  const transferRelief = provincialRelief + municipalRelief;
  const homeBuyersCredit = creditEligible ? 140_000 : 0;
  const fhsa = 4_000_000 * buyers;
  const hbp = 6_000_000 * buyers;
  const dollars = cents => cents / 100;
  const transferKnown = jurisdiction !== 'other';

  return {
    gstRebate: dollars(gstRebate),
    provincialTax: transferKnown ? dollars(provincialTax) : null,
    provincialRelief: transferKnown ? dollars(provincialRelief) : null,
    municipalTax: dollars(municipalTax),
    municipalRelief: dollars(municipalRelief),
    netTransferTax: transferKnown ? dollars(provincialTax + municipalTax - transferRelief) : null,
    titleFee: dollars(titleFee),
    mortgageFee: dollars(mortgageFee),
    bcExemption,
    homeBuyersCredit: dollars(homeBuyersCredit),
    fhsa: dollars(fhsa),
    hbp: dollars(hbp),
    downPaymentPool: dollars(fhsa + hbp),
    potentialRelief: dollars(gstRebate + transferRelief + homeBuyersCredit),
    closingSavings: dollars((gstAtClosing ? gstRebate : 0) + (transferAtClosing ? transferRelief : 0)),
  };
}
