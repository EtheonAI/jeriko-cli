(({ idAttr }) => {
  const elements = document.querySelectorAll(`[${idAttr}]`);
  for (const el of elements) {
    el.removeAttribute(idAttr);
  }
})
