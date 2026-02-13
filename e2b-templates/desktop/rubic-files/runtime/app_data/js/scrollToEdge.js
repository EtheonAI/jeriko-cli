({ axis, toStart }) => {
  const el = document.scrollingElement || document.documentElement || document.body;
  if (!el) return;
  if (axis === 'x') {
    const target = toStart ? 0 : el.scrollWidth;
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left: target, behavior: 'auto' });
    } else {
      window.scrollTo(target, window.scrollY);
    }
    return;
  }
  const target = toStart ? 0 : el.scrollHeight;
  if (typeof el.scrollTo === 'function') {
    el.scrollTo({ top: target, behavior: 'auto' });
  } else {
    window.scrollTo(window.scrollX, target);
  }
};
