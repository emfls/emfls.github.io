export const TAX_2026_27 = Object.freeze({
  annualExemptAmount: 3000,
  basicBand: 37700,
  basicRate: 0.18,
  higherRate: 0.24,
});

const SHARE_SCALE = 1_000_000;
const MAX_SHARES = 1_000_000_000;
const MAX_MONEY = 1_000_000_000_000;

function amount(value, label, min = 0, max = MAX_MONEY) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter a valid ${label}.`);
  }
  return value;
}

function shareUnits(value, label, min = 0) {
  amount(value, label, min, MAX_SHARES);
  const units = Math.round(value * SHARE_SCALE);
  if (units / SHARE_SCALE !== value) {
    throw new RangeError(`Use up to six decimal places for ${label}.`);
  }
  return units;
}

function matchSale(sale, laterUnits) {
  const sameDay = Math.min(sale.sold, sale.sameUnits);
  const within30Days = Math.min(sale.sold - sameDay, laterUnits);
  const fromPool = Math.min(sale.sold - sameDay - within30Days, sale.poolUnits);
  const unmatched = sale.sold - sameDay - within30Days - fromPool;
  if (unmatched) {
    return { unmatchedShares: unmatched / SHARE_SCALE };
  }

  const poolCostRemoved = sale.poolUnits ? sale.poolCost * (fromPool / sale.poolUnits) : 0;
  const buckets = {
    sameDay: { shares: sameDay / SHARE_SCALE, cost: sameDay / SHARE_SCALE * sale.samePrice },
    within30Days: {
      shares: within30Days / SHARE_SCALE,
      cost: within30Days / SHARE_SCALE * sale.laterPrice,
    },
    section104: { shares: fromPool / SHARE_SCALE, cost: poolCostRemoved },
  };

  const excessSame = (sale.sameUnits - sameDay) / SHARE_SCALE;
  const excessLater = (laterUnits - within30Days) / SHARE_SCALE;
  const poolShares = (sale.poolUnits - fromPool + sale.sameUnits - sameDay +
    laterUnits - within30Days) / SHARE_SCALE;
  const poolCost = sale.poolCost - poolCostRemoved +
    excessSame * sale.samePrice + excessLater * sale.laterPrice;
  const allowableCost = buckets.sameDay.cost + buckets.within30Days.cost + poolCostRemoved;

  return {
    unmatchedShares: 0,
    buckets,
    allowableCost,
    netProceeds: sale.netProceeds,
    gain: sale.netProceeds - allowableCost,
    pool: { shares: poolShares, cost: poolCost, averageCost: poolShares ? poolCost / poolShares : null },
  };
}

function annualTax(netGain, basicBandLeft, broughtForwardLosses, exemption) {
  const positiveGain = Math.max(0, netGain);
  const exemptionUsed = Math.min(positiveGain, exemption);
  const gainAfterExemption = positiveGain - exemptionUsed;
  const broughtForwardUsed = Math.min(broughtForwardLosses, gainAfterExemption);
  const chargeableGain = gainAfterExemption - broughtForwardUsed;
  const basicTax = Math.min(chargeableGain, basicBandLeft) * TAX_2026_27.basicRate;
  const higherTax = Math.max(0, chargeableGain - basicBandLeft) * TAX_2026_27.higherRate;
  return { exemptionUsed, broughtForwardUsed, chargeableGain, basicTax, higherTax, total: basicTax + higherTax };
}

export function calculateShareMatching(input) {
  const sold = shareUnits(input.sharesSold, 'number of shares sold', 1 / SHARE_SCALE);
  const poolUnits = shareUnits(input.poolShares, 'opening pool share count');
  const poolCost = amount(input.poolCost, 'opening pool cost');
  if (!poolUnits && poolCost) throw new RangeError('An empty opening pool must have zero cost.');

  const sameUnits = shareUnits(input.sameDayShares, 'same-day repurchase share count');
  const laterUnits = shareUnits(input.laterShares, 'later repurchase share count');
  const samePrice = sameUnits ? amount(input.sameDayPrice, 'same-day cost per share') : 0;
  const laterPrice = laterUnits ? amount(input.laterPrice, 'later cost per share') : 0;
  if (laterUnits && (!Number.isInteger(input.laterDay) || input.laterDay < 1 || input.laterDay > 30)) {
    throw new RangeError('Enter a whole number from 1 to 30 for days after the sale.');
  }
  const netProceeds = sold / SHARE_SCALE * amount(input.salePrice, 'sale price') -
    amount(input.saleFee, 'selling fee');

  const taxableIncome = amount(input.taxableIncome, 'taxable income');
  const otherGain = amount(input.otherGain, 'other net gains or losses', -MAX_MONEY);
  const broughtForwardLosses = amount(input.broughtForwardLosses, 'brought-forward losses');
  const basicBandLeft = Math.max(0, TAX_2026_27.basicBand - taxableIncome);
  const exemption = TAX_2026_27.annualExemptAmount;
  const prior = annualTax(otherGain, basicBandLeft, broughtForwardLosses, exemption);
  const priorWithoutExemption = annualTax(otherGain, basicBandLeft, broughtForwardLosses, 0);
  const sale = { sold, poolUnits, poolCost, sameUnits, samePrice, laterPrice, netProceeds };

  function withTax(match) {
    if (match.unmatchedShares) return match;

    const netGain = otherGain + match.gain;
    const annual = annualTax(netGain, basicBandLeft, broughtForwardLosses, exemption);
    const annualWithoutExemption = annualTax(netGain, basicBandLeft, broughtForwardLosses, 0);
    const impact = annual.total - prior.total;
    return {
      ...match,
      annual,
      taxImpact: {
        basic: annual.basicTax - prior.basicTax,
        higher: annual.higherTax - prior.higherTax,
        total: impact,
      },
      exemptionTaxSavedOnSale: Math.max(0, annualWithoutExemption.total - priorWithoutExemption.total - impact),
    };
  }

  const gia = withTax(matchSale(sale, laterUnits));
  const isa = withTax(matchSale(sale, 0));
  // A spouse's independent market purchase leaves the seller's matching and UK CGT unchanged from the ISA scenario.
  return { gia, isa, selected: input.rebuyInIsa ? isa : gia };
}
