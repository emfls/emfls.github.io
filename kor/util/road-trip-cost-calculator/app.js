(function (root) {
  function nonNegative(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function calculateRoadTripCost(options) {
    options = options || {};
    var distanceKm = nonNegative(options.distanceKm);
    var fuelEfficiency = nonNegative(options.fuelEfficiency);
    var fuelPrice = nonNegative(options.fuelPrice);
    var toll = nonNegative(options.toll);
    var parking = nonNegative(options.parking);
    var people = Math.max(1, Math.floor(nonNegative(options.people)) || 1);
    var totalDistanceKm = distanceKm * (options.roundTrip ? 2 : 1);
    var fuelLiters = fuelEfficiency ? totalDistanceKm / fuelEfficiency : 0;
    var fuelCost = Math.round(fuelLiters * fuelPrice);
    var totalCost = fuelCost + Math.round(toll) + Math.round(parking);

    return {
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      fuelLiters: Math.round(fuelLiters * 100) / 100,
      fuelCost: fuelCost,
      toll: Math.round(toll),
      parking: Math.round(parking),
      totalCost: totalCost,
      perPersonCost: Math.round(totalCost / people)
    };
  }

  root.calculateRoadTripCost = calculateRoadTripCost;
  if (typeof module !== 'undefined' && module.exports) module.exports = { calculateRoadTripCost: calculateRoadTripCost };

  if (typeof document !== 'undefined') {
    var analytics = document.createElement('script');
    analytics.src = '/kor/util/tool-analytics.js';
    document.head.appendChild(analytics);
    document.addEventListener('DOMContentLoaded', function () {
      document.getElementById('calculate')?.addEventListener('click', function () {
        if (typeof root.trackToolCompletion === 'function') root.trackToolCompletion('road_trip_cost', 'calculated');
      });
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
