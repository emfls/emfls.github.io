// All monetary inputs and outputs are integer pence.
export const MAX_PENCE = 100_000_000_000;

export function parsePounds(value) {
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value)) return null;
  const pence = Math.round(Number(value) * 100);
  return pence <= MAX_PENCE ? pence : null;
}

export function calculatePayments({
  assessedTax, atSource, capitalGains, studentLoans,
  priorJanuary, priorJuly, reserve, monthsToJanuary, forecastTax = null,
}) {
  const amounts = [assessedTax, atSource, capitalGains, studentLoans, priorJanuary, priorJuly, reserve];
  if (forecastTax !== null) amounts.push(forecastTax);
  if (amounts.some(value => !Number.isSafeInteger(value) || value < 0 || value > MAX_PENCE) ||
      !Number.isInteger(monthsToJanuary) || monthsToJanuary < 1 || monthsToJanuary > 12) {
    throw new RangeError('Enter valid amounts in pence and 1 to 12 January transfers.');
  }

  const netTax = assessedTax - atSource;
  const belowThreshold = netTax < 100_000;
  // Compare the exact ratio without rounding it for display.
  const overEightyPercent = assessedTax > 0 && atSource * 5 > assessedTax * 4;
  const triggered = !belowThreshold && !overEightyPercent;
  const poaBase = triggered ? netTax : 0;
  // HMRC allocates an odd penny to the July instalment.
  const firstPayment = Math.floor(poaBase / 2);
  const secondPayment = poaBase - firstPayment;
  const priorPayments = priorJanuary + priorJuly;
  const balancingPayment = netTax + capitalGains + studentLoans - priorPayments;
  const januaryNet = balancingPayment + firstPayment;
  const januaryDue = Math.max(0, januaryNet);
  const januaryCredit = Math.max(0, -januaryNet);

  const monthlyTransfer = Math.max(
    0,
    Math.ceil((januaryDue - reserve) / monthsToJanuary),
    Math.ceil((januaryDue + secondPayment - reserve) / (monthsToJanuary + 6)),
  );
  const schedule = [];
  let pot = reserve;
  for (let offset = 1 - monthsToJanuary; offset <= 6; offset += 1) {
    const due = offset === 0 ? januaryDue : offset === 6 ? secondPayment : 0;
    pot += monthlyTransfer - due;
    schedule.push({ month: offset, transfer: monthlyTransfer, due, pot });
  }

  let reduction = null;
  if (triggered && forecastTax !== null && forecastTax < poaBase) {
    const first = Math.floor(forecastTax / 2);
    reduction = {
      first,
      second: forecastTax - first,
      totalSavings: poaBase - forecastTax,
      januaryDue: Math.max(0, balancingPayment + first),
      januaryCredit: Math.max(0, -(balancingPayment + first)),
    };
  }

  return {
    netTax, belowThreshold, overEightyPercent, triggered, poaBase, priorPayments,
    firstPayment, secondPayment, balancingPayment, januaryDue, januaryCredit,
    monthlyTransfer, schedule, reduction,
  };
}
