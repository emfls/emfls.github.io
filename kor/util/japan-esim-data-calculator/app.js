(function (root) {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  function estimateEsimUsage(options) {
    const days = clamp(options.days, 1, 60);
    const dailyMb = clamp(options.maps, 0, 600) * 0.08 + clamp(options.messaging, 0, 600) * 0.05 +
      clamp(options.social, 0, 600) * 2 + clamp(options.music, 0, 600) * 1 + clamp(options.video, 0, 600) * 8;
    const baseGb = Math.min(80, Math.round((dailyMb * days / 1024) * (options.tethering ? 1.25 : 1) * 10) / 10);
    const totalGb = Math.min(100, Math.ceil(baseGb * 1.2 * 10) / 10);
    const recommendation = totalGb <= 1 ? '1GB' : totalGb <= 3 ? '3GB' : totalGb <= 5 ? '5GB' : totalGb <= 10 ? '10GB' : '무제한 요금제 고려';
    return { baseGb, totalGb, recommendation };
  }
  root.estimateEsimUsage = estimateEsimUsage;
  if (typeof module !== 'undefined') module.exports = { estimateEsimUsage };
  if (typeof document !== 'undefined') {
    const analytics = document.createElement('script');
    analytics.src = '/kor/util/tool-analytics.js';
    document.head.appendChild(analytics);
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('calculate')?.addEventListener('click', () => {
        if (typeof root.trackToolCompletion === 'function') root.trackToolCompletion('japan_esim', 'calculated');
      });
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
