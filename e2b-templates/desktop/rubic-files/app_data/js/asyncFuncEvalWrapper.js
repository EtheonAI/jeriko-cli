(code) => {
  const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
  const fn = new AsyncFunction(code);
  return fn();
}