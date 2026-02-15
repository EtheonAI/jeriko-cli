async ({
  x,
  y,
  direction = 'down',
  toEdge = false,
  pixelDelta,
} = {}) => {
  const validDirections = ['up', 'down', 'left', 'right'];
  if (!validDirections.includes(direction)) {
    return { scrolled: false, reason: 'invalid-direction' };
  }
  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
  const dir = direction === 'up' || direction === 'left' ? -1 : 1;
  const stepFallback = Math.max(
    120,
    Math.round((axis === 'y' ? window.innerHeight : window.innerWidth) * 0.6),
  );
  const delta = typeof pixelDelta === 'number' && Number.isFinite(pixelDelta) && pixelDelta > 0
    ? pixelDelta
    : stepFallback;

  const targetEl = document.elementFromPoint(x, y);
  if (!targetEl) {
    return { scrolled: false, reason: 'no-target' };
  }

  const isScrollable = (el) => {
    if (!el || !(el instanceof Element)) return false;
    if (el.clientHeight === 0 || el.clientWidth === 0) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const scrollableSpace = axis === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
    return scrollableSpace > 1 && Number.isFinite(scrollableSpace);
  };

  const describeElement = (el) => {
    const tag = el.tagName ? el.tagName.toLowerCase() : 'element';
    const idPart = el.id ? `#${el.id}` : '';
    const classList = (el.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 2);
    const classPart = classList.length ? `.${classList.join('.')}` : '';
    const ariaLabel = el.getAttribute ? el.getAttribute('aria-label') : null;
    const ariaPart = ariaLabel ? `[aria-label="${ariaLabel.slice(0, 40)}"]` : '';
    return `${tag}${idPart}${classPart}${ariaPart}`;
  };

  const buildPath = (el) => {
    const parts = [];
    let current = el;
    let safety = 0;
    while (current && safety < 8) {
      if (!(current instanceof Element)) break;
      parts.unshift(describeElement(current));
      const root = current.getRootNode ? current.getRootNode() : null;
      if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot && root.host && current !== root.host) {
        current = root.host;
      } else {
        current = current.parentElement;
      }
      safety += 1;
    }
    return parts.join(' > ');
  };

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

  const waitForScrollSettle = async (el, before) => {
    const immediate = readPosition(el);
    if (Math.abs(immediate - before) > 1) return immediate;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const afterFrame = readPosition(el);
    if (Math.abs(afterFrame - before) > 1) return afterFrame;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return readPosition(el);
  };

  let current = targetEl;
  let safety = 0;
  while (current && safety < 80) {
    if (!isScrollable(current)) {
      const root = current.getRootNode ? current.getRootNode() : null;
      if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot && root.host && current !== root.host) {
        current = root.host;
      } else {
        current = current.parentElement;
      }
      safety += 1;
      continue;
    }

    const before = readPosition(current);
    const maxOffset = axis === 'y'
      ? Math.max(current.scrollHeight - current.clientHeight, 0)
      : Math.max(current.scrollWidth - current.clientWidth, 0);
    const boundaryBefore = dir < 0 ? before <= 1 : before >= maxOffset - 1;

    const target = toEdge
      ? (dir < 0 ? 0 : maxOffset)
      : Math.min(Math.max(before + dir * delta, 0), maxOffset);

    try {
      if (axis === 'y') {
        if (typeof current.scrollTo === 'function') {
          current.scrollTo({ top: target, behavior: 'auto' });
        } else {
          current.scrollTop = target;
        }
      } else if (typeof current.scrollTo === 'function') {
        current.scrollTo({ left: target, behavior: 'auto' });
      } else {
        current.scrollLeft = target;
      }
    } catch (e) {
      return { scrolled: false, reason: 'scroll-failed', error: e.message };
    }
    
    const after = await waitForScrollSettle(current, before);
    const moved = Math.abs(after - before) > 1;
    const atBoundary = dir < 0 ? after <= 1 : after >= maxOffset - 1;

    return {
      scrolled: moved,
      targetDescription: describeElement(current),
      path: buildPath(current),
      before,
      after,
      atBoundary,
      boundaryBefore,
      maxOffset,
    };
  }

  return { scrolled: false, reason: 'no-scrollable-at-point' };
};
