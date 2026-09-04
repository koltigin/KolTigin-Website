(function (root) {
  const NOTICE_MS = 3000;

  function savedMessage(isProduction, translate) {
    return isProduction ? translate('save.success') : translate('save.locally');
  }

  function createStatusController(clock) {
    const setTimeoutFn = clock.setTimeout.bind(clock);
    const clearTimeoutFn = clock.clearTimeout.bind(clock);
    let timer = 0;

    function stop() {
      if (timer) {
        clearTimeoutFn(timer);
        timer = 0;
      }
    }

    return {
      NOTICE_MS,
      stop,
      clearStatus(state) {
        stop();
        state.notice = '';
        state.noticeTone = '';
        state.error = '';
      },
      showNotice(state, message, onExpire, options) {
        stop();
        state.error = '';
        state.notice = message;
        state.noticeTone = options && options.tone ? options.tone : '';
        timer = setTimeoutFn(() => {
          timer = 0;
          state.notice = '';
          state.noticeTone = '';
          if (onExpire) onExpire();
        }, NOTICE_MS);
      },
      showError(state, message) {
        stop();
        state.notice = '';
        state.noticeTone = '';
        state.error = message || '';
      }
    };
  }

  const api = { NOTICE_MS, savedMessage, createStatusController };
  root.KTAdminStatus = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
