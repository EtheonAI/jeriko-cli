(uniqueId) => {
  const element = document.querySelector(`[data-playwright-temp-id="${uniqueId}"]`);
  if (element) element.removeAttribute('data-playwright-temp-id');
}