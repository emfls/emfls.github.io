// Upper bounds in CAD and marginal rates in basis points.
const federalBrackets = [
  [58523, 1400], [117045, 2050], [181440, 2600], [258482, 2900], [Infinity, 3300],
];

const provincialBrackets = {
  ON: [[53891, 505], [107785, 915], [150000, 1116], [220000, 1216], [Infinity, 1316]],
  BC: [[50363, 560], [100728, 770], [115648, 1050], [140430, 1229], [190405, 1470], [265545, 1680], [Infinity, 2050]],
  AB: [[61200, 800], [154259, 1000], [185111, 1200], [246813, 1300], [370220, 1400], [Infinity, 1500]],
  QC: [[54345, 1400], [108680, 1900], [132245, 2400], [Infinity, 2575]],
};

const excludedFromBoth = new Set(['retirement', 'tfsa', 'cadCash']);
const assetKinds = new Set(['capital', 'personal', 'canadianRealEstate', ...excludedFromBoth]);

function cents(amount, label, maximum = 1e9) {
  const rounded = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || amount > maximum || rounded / 100 !== amount) {
    throw new RangeError(`${label} must be a non-negative amount with at most two decimal places (maximum $${maximum.toLocaleString("en-CA")}).`);
  }
  return rounded;
}

function checkProvince(province) {
  if (!Object.hasOwn(provincialBrackets, province)) {
    throw new RangeError('Choose Ontario, British Columbia, Alberta, or Quebec.');
  }
}

function incrementalTax(income, addedIncome, brackets) {
  const newIncome = income + addedIncome;
  let lower = 0;
  let weightedCents = 0;
  for (const [upper, rate] of brackets) {
    weightedCents += Math.max(0, Math.min(newIncome, upper * 100) - Math.max(income, lower)) * rate;
    if (newIncome <= upper * 100) break;
    lower = upper * 100;
  }
  return weightedCents / 10000;
}

export function t1161Penalty(filingRequired, daysLate) {
  if (!Number.isSafeInteger(daysLate) || daysLate < 0) {
    throw new RangeError('Days late must be a non-negative whole number.');
  }
  if (!filingRequired || daysLate === 0) return 0;
  return Math.min(2500, Math.max(100, daysLate * 25));
}

export function estimateDeferral(province, federalTax) {
  checkProvince(province);
  const federalCents = cents(federalTax, 'Federal departure tax', Number.MAX_SAFE_INTEGER / 100);
  const thresholdCents = province === 'QC' ? 1377750 : 1650000;
  return {
    threshold: thresholdCents / 100,
    securityRequired: federalCents > thresholdCents,
    federalSecurityEstimate: Math.max(0, federalCents - thresholdCents) / 100,
  };
}

export function calculateDepartureTax({
  province, ytdCanadianIncome, residentMonths, assets, daysLate = 0,
}) {
  checkProvince(province);
  const income = cents(ytdCanadianIncome, 'Taxable income before departure gains');
  if (!Number.isFinite(residentMonths) || residentMonths < 0 || residentMonths > 120) {
    throw new RangeError('Enter between 0 and 120 months of Canadian tax residency.');
  }

  let reportable = 0;
  let gain = 0;
  let excluded = 0;
  let shortStayExempt = 0;

  const assetResults = assets.map((asset, index) => {
    const { kind, preArrivalOrInherited, taxableCanadianProperty } = asset;
    if (!assetKinds.has(kind)) throw new RangeError(`Choose a valid type for asset ${index + 1}.`);
    const fmv = cents(asset.fmv, `Fair market value for asset ${index + 1}`);
    const personal = kind === 'personal';
    const canadianRealEstate = kind === 'canadianRealEstate';
    const shortStay = !canadianRealEstate && !excludedFromBoth.has(kind)
      && residentMonths <= 60 && preArrivalOrInherited === true;
    const reportableAsset = !excludedFromBoth.has(kind)
      && !(shortStay && taxableCanadianProperty !== true)
      && !(personal && fmv < 1000000);
    const deemedDisposition = !excludedFromBoth.has(kind) && !canadianRealEstate && !shortStay;

    let assetGain = 0;
    if (deemedDisposition) {
      const acb = cents(asset.acb, `Adjusted cost base for asset ${index + 1}`);
      assetGain = personal ? Math.max(0, fmv - Math.max(acb, 100000)) : fmv - acb;
      gain += assetGain;
    } else {
      excluded += fmv;
    }
    if (reportableAsset) reportable += fmv;
    if (shortStay) shortStayExempt += fmv;

    return { reportable: reportableAsset, deemedDisposition, gain: assetGain / 100 };
  });

  const filingRequired = reportable > 2500000;
  const taxableGainCents = Math.max(0, gain) / 2;
  const federalBeforeAbatement = incrementalTax(income, taxableGainCents, federalBrackets);
  const federalCents = Math.round(federalBeforeAbatement * (province === 'QC' ? 0.835 : 1));
  const provincialCents = Math.round(incrementalTax(income, taxableGainCents, provincialBrackets[province]));

  return {
    reportableFmv: reportable / 100,
    filingRequired,
    latePenalty: t1161Penalty(filingRequired, daysLate),
    excludedFmv: excluded / 100,
    shortStayExemptFmv: shortStayExempt / 100,
    netUnrealizedGain: Math.max(0, gain) / 100,
    taxableCapitalGain: taxableGainCents / 100,
    federalTax: federalCents / 100,
    provincialTax: provincialCents / 100,
    totalTax: (federalCents + provincialCents) / 100,
    deferral: estimateDeferral(province, federalCents / 100),
    assetResults,
  };
}
