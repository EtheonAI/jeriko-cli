((axis) => {
  const root = document.scrollingElement || document.documentElement;
  if (!root) return { hasGlobal: false, element: null, reason: 'no-root' };
  const style = root instanceof Element ? getComputedStyle(root) : null;
  if (style) {
    const overflow = axis === 'x' ? (style.overflowX || style.overflow) : (style.overflowY || style.overflow);
    if (overflow === 'hidden' || overflow === 'clip') {
      return { hasGlobal: false, element: null, reason: 'root-overflow-hidden' };
    }
  }
  const scrollSpace = axis === 'x' ? root.scrollWidth - root.clientWidth : root.scrollHeight - root.clientHeight;
  if (!Number.isFinite(scrollSpace) || scrollSpace <= 2) {
    return { hasGlobal: false, element: null, reason: 'no-root-scroll-space' };
  }
  return {
    hasGlobal: true,
    element: 'html',
    reason: axis === 'x' ? 'root-scrollable-x' : 'root-scrollable-y',
    scrollWidth: root.scrollWidth,
    clientWidth: root.clientWidth,
    scrollHeight: root.scrollHeight,
    clientHeight: root.clientHeight,
  };
});
