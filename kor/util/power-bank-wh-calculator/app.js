(function (root) {
  function calculatePowerBankWh(options) {
    options = options || {};
    var mah = Number(options.mah);
    var voltage = Number(options.voltage);
    if (!Number.isFinite(mah) || !Number.isFinite(voltage) || mah <= 0 || voltage <= 0) {
      return { wh: null, band: 'INVALID' };
    }
    var wh = Math.round((mah / 1000) * voltage * 100) / 100;
    var band = wh <= 100 ? 'UNDER_OR_EQUAL_100' : wh <= 160 ? 'OVER_100_TO_160' : 'OVER_160';
    return { wh: wh, band: band };
  }

  root.calculatePowerBankWh = calculatePowerBankWh;
  if (typeof module !== 'undefined' && module.exports) module.exports = { calculatePowerBankWh: calculatePowerBankWh };

  if (typeof document !== 'undefined') {
    var analytics = document.createElement('script');
    analytics.src = '/kor/util/tool-analytics.js';
    document.head.appendChild(analytics);
    document.addEventListener('DOMContentLoaded', function () {
      document.getElementById('calculate')?.addEventListener('click', function () {
        if (typeof root.trackToolCompletion === 'function') root.trackToolCompletion('power_bank_wh', 'calculated');
      });
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
