// Re-implement the Promise combinators without using them.

function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const items = [...iterable];
    const results = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return resolve(results);
    items.forEach((item, i) => {
      // Promise.resolve lets plain values and thenables mix with real promises
      Promise.resolve(item).then((value) => {
        results[i] = value; // by index, not push: order follows the input, not finish time
        if (--remaining === 0) resolve(results);
      }, reject); // the first rejection wins; later settles are ignored by the settled promise
    });
  });
}

function promiseAllSettled(iterable) {
  return promiseAll(
    [...iterable].map((item) =>
      Promise.resolve(item).then(
        (value) => ({ status: "fulfilled", value }),
        (reason) => ({ status: "rejected", reason }),
      ),
    ),
  );
}

function promiseRace(iterable) {
  return new Promise((resolve, reject) => {
    for (const item of iterable) Promise.resolve(item).then(resolve, reject);
  });
}

function promiseAny(iterable) {
  return new Promise((resolve, reject) => {
    const items = [...iterable];
    const errors = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return reject(new AggregateError([], "All promises were rejected"));
    items.forEach((item, i) =>
      Promise.resolve(item).then(resolve, (err) => {
        errors[i] = err;
        if (--remaining === 0) reject(new AggregateError(errors, "All promises were rejected"));
      }),
    );
  });
}

module.exports = { promiseAll, promiseAllSettled, promiseRace, promiseAny };
