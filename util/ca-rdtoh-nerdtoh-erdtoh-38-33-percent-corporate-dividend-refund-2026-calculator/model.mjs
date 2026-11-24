export const REFUND_RATE = 23 / 60;
export const PART_I_REFUNDABLE_RATE = 23 / 75;
export const FEDERAL_PASSIVE_RATE = 29 / 75;
export const CAPITAL_GAIN_INCLUSION = 1 / 2;
export const MAX_AMOUNT = 1_000_000_000;

const provinces = {
  ON: { corporate: 0.115, personal: 0.1316, surtax: 1.56, abatement: 1, eligibleCredit: 0.10, nonEligibleCredit: 0.029863 },
  BC: { corporate: 0.12, personal: 0.205, surtax: 1, abatement: 1, eligibleCredit: 0.12, nonEligibleCredit: 0.0196 },
  AB: { corporate: 0.08, personal: 0.15, surtax: 1, abatement: 1, eligibleCredit: 0.0812, nonEligibleCredit: 0.0218 },
  QC: { corporate: 0.115, personal: 0.2575, surtax: 1, abatement: 0.835, eligibleCredit: 0.117, nonEligibleCredit: 0.0342 }
};

function requireNonnegative(...amounts) {
  if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
    throw new RangeError('Amounts must be finite non-negative numbers.');
  }
}

function provinceRates(province) {
  if (!Object.hasOwn(provinces, province)) throw new RangeError('Unsupported province.');
  return provinces[province];
}

export function calculateRefund(nerdtoh, erdtoh, eligiblePaid, nonEligiblePaid) {
  requireNonnegative(nerdtoh, erdtoh, eligiblePaid, nonEligiblePaid);
  const eligibleFromErdtoh = Math.min(erdtoh, eligiblePaid * REFUND_RATE);
  const nonEligibleCapacity = nonEligiblePaid * REFUND_RATE;
  const nonEligibleFromNerdtoh = Math.min(nerdtoh, nonEligibleCapacity);
  const nonEligibleFromErdtoh = Math.min(erdtoh - eligibleFromErdtoh, nonEligibleCapacity - nonEligibleFromNerdtoh);
  return {
    eligibleFromErdtoh,
    nonEligibleFromNerdtoh,
    nonEligibleFromErdtoh,
    total: eligibleFromErdtoh + nonEligibleFromNerdtoh + nonEligibleFromErdtoh,
    remainingNerdtoh: nerdtoh - nonEligibleFromNerdtoh,
    remainingErdtoh: erdtoh - eligibleFromErdtoh - nonEligibleFromErdtoh
  };
}

function payoutToCent(balance) {
  const exactCents = balance / REFUND_RATE * 100;
  const wholeCents = Math.round(exactCents);
  const roundingNoise = Number.EPSILON * exactCents * 2;
  return (Math.abs(exactCents - wholeCents) <= roundingNoise ? wholeCents : Math.ceil(exactCents)) / 100;
}

export function payoutTargets(nerdtoh, erdtoh) {
  requireNonnegative(nerdtoh, erdtoh);
  return {
    eligible: payoutToCent(erdtoh),
    nonEligible: payoutToCent(nerdtoh),
    allNonEligible: payoutToCent(nerdtoh + erdtoh)
  };
}

function dividendTaxRates(rates) {
  const provincialRate = rates.personal * rates.surtax;
  return {
    eligible: 1.38 * ((0.33 - 0.150198) * rates.abatement + provincialRate - rates.eligibleCredit),
    nonEligible: 1.15 * ((0.33 - 0.090301) * rates.abatement + provincialRate - rates.nonEligibleCredit)
  };
}

export function personalDividendTax(province, eligiblePaid, nonEligiblePaid) {
  requireNonnegative(eligiblePaid, nonEligiblePaid);
  const rates = dividendTaxRates(provinceRates(province));
  return eligiblePaid * rates.eligible + nonEligiblePaid * rates.nonEligible;
}

export function calculate({
  province = 'ON', interest = 0, rent = 0, foreignDividends = 0, capitalGains = 0,
  eligibleReceived = 0, nonEligibleReceived = 0, openingNerdtoh = 0, openingErdtoh = 0,
  eligiblePaid = 0, nonEligiblePaid = 0, openingCash = 0, eligibleRoom = 0
} = {}) {
  const amounts = [interest, rent, foreignDividends, capitalGains, eligibleReceived, nonEligibleReceived,
    openingNerdtoh, openingErdtoh, eligiblePaid, nonEligiblePaid, openingCash, eligibleRoom];
  requireNonnegative(...amounts);
  if (amounts.some((amount) => amount > MAX_AMOUNT)) throw new RangeError('An amount exceeds the calculator limit.');

  const rates = provinceRates(province);
  const dividendRates = dividendTaxRates(rates);
  const aggregateInvestmentIncome = interest + rent + foreignDividends + capitalGains * CAPITAL_GAIN_INCLUSION;
  const grossIncome = interest + rent + foreignDividends + capitalGains + eligibleReceived + nonEligibleReceived;
  const passiveCorporateRate = FEDERAL_PASSIVE_RATE + rates.corporate;
  const partITax = aggregateInvestmentIncome * passiveCorporateRate;
  const partIVEligible = eligibleReceived * REFUND_RATE;
  const partIVNonEligible = nonEligibleReceived * REFUND_RATE;
  const corporateTax = partITax + partIVEligible + partIVNonEligible;
  const nerdtohAddition = aggregateInvestmentIncome * PART_I_REFUNDABLE_RATE + partIVNonEligible;
  const erdtohAddition = partIVEligible;
  const availableNerdtoh = openingNerdtoh + nerdtohAddition;
  const availableErdtoh = openingErdtoh + erdtohAddition;
  const refund = calculateRefund(availableNerdtoh, availableErdtoh, eligiblePaid, nonEligiblePaid);
  const payout = payoutTargets(availableNerdtoh, availableErdtoh);
  const dividendsPaid = eligiblePaid + nonEligiblePaid;
  const netCorporateTax = corporateTax - refund.total;
  const personalTax = eligiblePaid * dividendRates.eligible + nonEligiblePaid * dividendRates.nonEligible;
  const combinedTax = netCorporateTax + personalTax;
  const cashIfRetained = openingCash + grossIncome - corporateTax;
  const retainedCash = cashIfRetained - dividendsPaid + refund.total;
  const shareholderCash = dividendsPaid - personalTax;
  return {
    ...refund, payout, aggregateInvestmentIncome, grossIncome, passiveCorporateRate,
    partITax, partIVEligible, partIVNonEligible, corporateTax, nerdtohAddition, erdtohAddition,
    availableNerdtoh, availableErdtoh, eligibleRate: dividendRates.eligible,
    nonEligibleRate: dividendRates.nonEligible, netCorporateTax, personalTax, combinedTax,
    cashIfRetained, retainedCash, shareholderCash, combinedCash: retainedCash + shareholderCash,
    effectiveRate: grossIncome > 0 ? combinedTax / grossIncome : null,
    preRefundShortfall: Math.max(0, dividendsPaid - cashIfRetained),
    eligibleRoomShortfall: Math.max(0, eligiblePaid - eligibleRoom)
  };
}
