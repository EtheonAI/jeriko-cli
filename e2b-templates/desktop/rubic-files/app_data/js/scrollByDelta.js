(({ axis, deltaValue }) => {
  const el = document.scrollingElement || document.documentElement || document.body;
  if (!el) return;
  if (axis === 'x') {
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left: el.scrollLeft + deltaValue, behavior: 'auto' });
    } else {
      window.scrollBy(deltaValue, 0);
    }
    return;
  }
  if (typeof el.scrollTo === 'function') {
    el.scrollTo({ top: el.scrollTop + deltaValue, behavior: 'auto' });
  } else {
    window.scrollBy(0, deltaValue);
  }
});
