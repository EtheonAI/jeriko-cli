async ({ direction, toEdge, delta }) => {
  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
  const dir = direction === 'up' || direction === 'left' ? -1 : 1;
  const root = document.scrollingElement || document.documentElement || document.body;
  if (!root) return { ok: false, reason: 'no-root' };

  const readPosition = (el) => {
    if (!el) return 0;
    if (el === document.body || el === document.documentElement) {
      const winPos = axis === 'y' ? window.scrollY : window.scrollX;
      if (typeof winPos === 'number' && Number.isFinite(winPos)) return winPos;
    }
    const val = axis === 'y' ? el.scrollTop : el.scrollLeft;
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    return 0;
  };

  const waitForScrollSettle = async (el, beforePos) => {
    const immediate = readPosition(el);
    if (Math.abs(immediate - beforePos) > 1) return immediate;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const afterFrame = readPosition(el);
    if (Math.abs(afterFrame - beforePos) > 1) return afterFrame;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return readPosition(el);
  };

  const before = readPosition(root);
  const max = axis === 'y'
    ? Math.max(root.scrollHeight - root.clientHeight, 0)
    : Math.max(root.scrollWidth - root.clientWidth, 0);
  const boundaryBefore = dir < 0 ? before <= 1 : before >= max - 1;

  const rawViewportSize = axis === 'y'
    ? (typeof root.clientHeight === 'number' && root.clientHeight > 0 ? root.clientHeight : window.innerHeight)
    : (typeof root.clientWidth === 'number' && root.clientWidth > 0 ? root.clientWidth : window.innerWidth);
  const viewportSize = Number.isFinite(rawViewportSize) && rawViewportSize > 0 ? rawViewportSize : 240;
  const step = Number.isFinite(delta) && delta > 0 ? delta : Math.max(viewportSize * 0.5, 120);

  const target = toEdge
    ? (dir < 0 ? 0 : max)
    : Math.min(Math.max(before + dir * step, 0), max);

  if (axis === 'y') {
    if (typeof root.scrollTo === 'function') {
      root.scrollTo({ top: target, behavior: 'auto' });
    } else {
      window.scrollTo(0, target);
    }
  } else if (typeof root.scrollTo === 'function') {
    root.scrollTo({ left: target, behavior: 'auto' });
  } else {
    window.scrollTo(target, window.scrollY);
  }

  const after = await waitForScrollSettle(root, before);
  const moved = Math.abs(after - before) > 1;
  const atBoundary = dir < 0 ? after <= 1 : after >= max - 1;

  let targetDescription = 'page';
  if (root === document.documentElement) targetDescription = 'html';
  if (root === document.body) targetDescription = 'body';

  return {
    ok: true,
    moved,
    atBoundary,
    boundaryBefore,
    targetDescription,
  };
};
