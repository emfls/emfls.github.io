(function (root) {
  var allowedTools = ['camping_packing', 'japan_packing', 'japan_esim', 'car_camping_permission'];
  var allowedResults = ['generated', 'calculated', 'allowed', 'check_more', 'do_not_use'];

  function trackToolCompletion(toolName, resultType) {
    if (allowedTools.indexOf(toolName) === -1 || allowedResults.indexOf(resultType) === -1) return false;
    if (typeof root.gtag !== 'function') return false;
    root.gtag('event', 'tool_complete', { tool_name: toolName, result_type: resultType });
    return true;
  }

  root.trackToolCompletion = trackToolCompletion;
  if (typeof module !== 'undefined' && module.exports) module.exports = { trackToolCompletion: trackToolCompletion };
})(typeof window !== 'undefined' ? window : globalThis);
