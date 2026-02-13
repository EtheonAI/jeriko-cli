(() => {
  const body = document.body;
  if (!body) {
    return '';
  }
  return body.innerText || '';
})();
