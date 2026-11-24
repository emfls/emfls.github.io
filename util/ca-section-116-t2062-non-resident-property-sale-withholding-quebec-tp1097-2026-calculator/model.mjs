const FEDERAL_BRACKETS = [[58523, .14], [117045, .205], [181440, .26], [258482, .29], [Infinity, .33]];
const QUEBEC_BRACKETS = [[54345, .14], [108680, .19], [132245, .24], [Infinity, .2575]];
const MAX_AMOUNT = 1_000_000_000;

const money = value => Math.sign(value) * Math.round((Math.abs(value) + 1e-8) * 100) / 100;
const positive = value => Math.max(0, value);

function bracketTax(income, brackets) {
  let tax = 0;
  let floor = 0;
  for (const [ceiling, rate] of brackets) {
    tax += (Math.min(income, ceiling) - floor) * rate;
    if (income <= ceiling) break;
    floor = ceiling;
  }
  return tax;
}

function account(holdback, certificate, tax, penalty, grossRemitted) {
  const payment = grossRemitted ? holdback : certificate;
  const settlement = payment === null || tax === null ? null : money(payment - tax);
  return {
    holdback, certificate, tax, penalty,
    refund: settlement === null ? null : positive(settlement),
    balanceDue: settlement === null ? null : positive(-settlement)
  };
}

// A null amount marks a missing special-property input. Closing estimates still work.
export function estimateSale({
  property = 'capital', quebec = false, hypothetical35 = false, grossRemitted = false,
  proceeds, costBase, commission = 0, legalFees = 0, otherIncome = 0,
  daysToCra = 0, daysToQuebec = 0, buildingProceeds = 0, buildingCost = 0,
  recapture = null, federalSpecialPayment = null, quebecSpecialPayment = null
}) {
  const rental = property === 'rental';
  const inventory = property === 'inventory';
  const special = rental || inventory;
  if (!['capital', 'rental', 'inventory'].includes(property)) throw new RangeError('Choose a property type.');

  const amounts = [proceeds, costBase, commission, legalFees, otherIncome];
  if (rental) amounts.push(buildingProceeds, buildingCost);
  if (rental && recapture !== null) amounts.push(recapture);
  if (special && federalSpecialPayment !== null) amounts.push(federalSpecialPayment);
  if (special && quebec && quebecSpecialPayment !== null) amounts.push(quebecSpecialPayment);
  if (amounts.some(value => !Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) || proceeds === 0) {
    throw new RangeError('Enter valid amounts up to C$1 billion and a sale price above zero.');
  }
  if (rental && (buildingProceeds <= 0 || buildingProceeds > proceeds || buildingCost > costBase
    || (buildingProceeds === proceeds && buildingCost !== costBase))) {
    throw new RangeError('Enter positive building proceeds and keep both building allocations within their sale totals.');
  }
  if (commission + legalFees > proceeds) throw new RangeError('Selling costs must be within gross proceeds.');
  if (![daysToCra, ...(quebec ? [daysToQuebec] : [])].every(days => Number.isSafeInteger(days) && Math.abs(days) <= 36500)) {
    throw new RangeError('Enter whole days between −36,500 and 36,500.');
  }

  const federalRate = hypothetical35 ? .35 : .25;
  const specialProceeds = inventory ? proceeds : rental ? buildingProceeds : 0;
  const ordinaryProceeds = proceeds - specialProceeds;
  const landGain = rental ? ordinaryProceeds - (costBase - buildingCost) : 0;
  const buildingGain = rental ? positive(buildingProceeds - buildingCost) : 0;
  const capitalGain = inventory ? 0 : rental ? positive(landGain) + buildingGain : positive(proceeds - costBase);
  const sellingCosts = commission + legalFees;
  const landFees = rental ? sellingCosts * ordinaryProceeds / proceeds : 0;
  const buildingFees = rental ? sellingCosts - landFees : 0;
  const gainAfterCosts = inventory ? 0 : rental
    ? landGain - landFees + positive(buildingProceeds - buildingCost - buildingFees)
    : proceeds - costBase - sellingCosts;
  const taxableGain = money(positive(gainAfterCosts) * .5);
  const taxableIncome = rental && recapture === null ? null : money(
    inventory ? positive(proceeds - costBase - sellingCosts) : taxableGain + (rental ? recapture : 0)
  );

  const craHoldback = money(ordinaryProceeds * federalRate + specialProceeds * .50);
  const qcHoldback = quebec ? money(ordinaryProceeds * .12875 + specialProceeds * .30) : 0;
  // Special payments are entered separately from the automatically calculated gain component.
  const craCertificate = special && federalSpecialPayment === null ? null : money(
    capitalGain * federalRate + (special ? federalSpecialPayment : 0)
  );
  const qcCertificate = !quebec ? 0 : special && quebecSpecialPayment === null ? null : money(
    (rental ? positive(landGain) : capitalGain) * .12875 + (special ? quebecSpecialPayment : 0)
  );

  // The 10-day penalty applies to the regular notice, including a separately reportable rental land sale.
  const noticeRequired = !inventory && (!rental || ordinaryProceeds > 0);
  const lateCra = noticeRequired ? positive(daysToCra - 10) : 0;
  const lateQuebec = quebec && noticeRequired ? positive(daysToQuebec - 10) : 0;
  const craPenalty = lateCra ? Math.max(100, Math.min(2500, 25 * lateCra)) : 0;
  const qcPenalty = Math.min(2500, 25 * lateQuebec);

  const craTax = taxableIncome === null ? null : money(
    (bracketTax(otherIncome + taxableIncome, FEDERAL_BRACKETS) - bracketTax(otherIncome, FEDERAL_BRACKETS))
    * (quebec ? 1 : 1.48)
  );
  const qcTax = !quebec ? 0 : taxableIncome === null ? null : money(
    bracketTax(otherIncome + taxableIncome, QUEBEC_BRACKETS) - bracketTax(otherIncome, QUEBEC_BRACKETS)
  );
  const cra = account(craHoldback, craCertificate, craTax, craPenalty, grossRemitted);
  const qc = account(qcHoldback, qcCertificate, qcTax, qcPenalty, grossRemitted);

  const grossHoldback = money(craHoldback + qcHoldback);
  const certificateRemittance = craCertificate === null || qcCertificate === null
    ? null : money(craCertificate + qcCertificate);
  return {
    cra, qc, grossHoldback, certificateRemittance, capitalGain, taxableGain, taxableIncome,
    cashReleased: certificateRemittance === null ? null : money(grossHoldback - certificateRemittance),
    latePenalty: craPenalty + qcPenalty
  };
}
