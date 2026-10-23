/**
 * Delay calling fn until `wait` ms pass without another call.
 * leading: also call on the first call of a burst. trailing: call at the end of the burst (default).
 */
function debounce(fn, wait, { leading = false, trailing = true } = {}) {
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let result;

  function invoke() {
    const args = lastArgs;
    const ctx = lastThis;
    lastArgs = lastThis = null;
    result = fn.apply(ctx, args);
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this; // keep `this`, so it works as an object method too
    const isFirstOfBurst = timer === null;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (trailing && lastArgs) invoke(); // lastArgs is null if leading already consumed the only call
    }, wait);
    if (leading && isFirstOfBurst) invoke();
    return result;
  }

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = lastArgs = lastThis = null;
  };
  debounced.flush = () => {
    if (timer !== null && lastArgs) {
      clearTimeout(timer);
      timer = null;
      invoke();
    }
    return result;
  };
  return debounced;
}

module.exports = { debounce };
