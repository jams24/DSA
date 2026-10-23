/**
 * Run fn at most once per `wait` ms. The first call runs immediately; calls during the cooldown
 * are collapsed into one trailing call with the latest arguments.
 * (Debounce waits for quiet. Throttle guarantees a steady rate while calls keep coming.)
 */
function throttle(fn, wait) {
  let last = -Infinity; // time fn last ran
  let timer = null;
  let pending = null; // [this, args] of the latest call during cooldown

  function run(ctx, args) {
    last = Date.now();
    fn.apply(ctx, args);
  }

  function throttled(...args) {
    const remaining = wait - (Date.now() - last);
    if (remaining <= 0 && timer === null) {
      run(this, args);
    } else {
      pending = [this, args];
      if (timer === null)
        timer = setTimeout(() => {
          timer = null;
          const [ctx, a] = pending;
          pending = null;
          run(ctx, a);
        }, Math.max(0, remaining));
    }
  }

  throttled.cancel = () => {
    clearTimeout(timer);
    timer = pending = null;
    last = -Infinity;
  };
  return throttled;
}

module.exports = { throttle };
