(function (root) {
  function assessCarCamping(answers) {
    var keys = ['manager', 'sign', 'overnight', 'setup', 'fire'];
    if (keys.some(function (key) { return answers[key] === false; })) {
      return {
        status: '이용하지 않기',
        message: '금지 또는 불허 항목이 있습니다. 다른 공식 야영장을 찾으세요.'
      };
    }
    if (keys.every(function (key) { return answers[key] === true; })) {
      return {
        status: '공식 허용 확인',
        message: '모든 항목을 확인했습니다. 그래도 당일 현장 공지와 안전 상태를 다시 확인하세요.'
      };
    }
    return {
      status: '추가 확인 필요',
      message: '확인하지 못했다면 이용하지 마세요. 관리 주체에 숙박·설치·취사 허용 여부를 문의하세요.'
    };
  }

  function readValue(form, name) {
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    if (!checked) return null;
    return checked.value === 'yes';
  }

  function bind() {
    var form = document.getElementById('permission-checker');
    var output = document.getElementById('permission-result');
    if (!form || !output) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var result = assessCarCamping({
        manager: readValue(form, 'manager'),
        sign: readValue(form, 'sign'),
        overnight: readValue(form, 'overnight'),
        setup: readValue(form, 'setup'),
        fire: readValue(form, 'fire')
      });
      output.innerHTML = '<strong>' + result.status + '</strong><br>' + result.message;
      output.dataset.status = result.status;
      output.focus();
    });
  }

  root.assessCarCamping = assessCarCamping;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { assessCarCamping: assessCarCamping };
  }
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', bind);
})(typeof window !== 'undefined' ? window : globalThis);
