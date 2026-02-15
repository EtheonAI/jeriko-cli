(() => {
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  const minWidth = vw * 0.5;
  const minHeight = vh * 0.5;

  const isScrollable = (el) => {
    const style = getComputedStyle(el);
    const scrollableX =
      el.scrollWidth - el.clientWidth > 2 &&
      style.overflowX !== 'hidden' &&
      style.overflowX !== 'clip';
    const scrollableY =
      el.scrollHeight - el.clientHeight > 2 &&
      style.overflowY !== 'hidden' &&
      style.overflowY !== 'clip';
    return scrollableX || scrollableY;
  };

  return Array.from(document.querySelectorAll('*')).some((el) => {
    if (!(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < minWidth || rect.height < minHeight) return false;
    return isScrollable(el);
  });
})();
