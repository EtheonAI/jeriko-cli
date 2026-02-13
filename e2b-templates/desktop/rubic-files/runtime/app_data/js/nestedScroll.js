async ({
  direction = 'down',
  toEdge = false,
  pixelDelta,
  targetPoint,
  preferLargest = false,
  minViewportRatio = 0,
} = {}) => {
  const validDirections = ['up', 'down', 'left', 'right'];
  if (!validDirections.includes(direction)) {
    return { scrolled: false, reason: 'invalid-direction' };
  } 
  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
  const dir = direction === 'up' || direction === 'left' ? -1 : 1;

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

  const dedupe = (arr) => {
    const seen = new Set();
    return arr.filter((el) => {
      if (!el || seen.has(el)) return false;
      seen.add(el);
      return true;
    });
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

  const getChainFromPoint = () => {
    if (!Array.isArray(targetPoint) || targetPoint.length !== 2) return [];
    const [px, py] = targetPoint;
    const start = document.elementFromPoint(px, py);
    if (!start) return [];
    const chain = [];
    let current = start;
    let safety = 0;
    while (current && safety < 50) {
      if (current instanceof Element) chain.push(current);
      const root = current.getRootNode ? current.getRootNode() : null;
      if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot && root.host && current !== root.host) {
        current = root.host;
      } else {
        current = current.parentElement;
      }
      safety += 1;
    }
    return chain;
  };

  const pickLargestScrollable = () => {
    if (!preferLargest) return null;
    const minWidth = Math.max(window.innerWidth * minViewportRatio, 0);
    const minHeight = Math.max(window.innerHeight * minViewportRatio, 0);
    const base = [
      document.scrollingElement,
      document.documentElement,
      document.body,
    ].filter(Boolean);
    const all = dedupe([...base, ...Array.from(document.querySelectorAll('*'))]);
    const scored = all
      .filter((el) => {
        if (!isScrollable(el)) return false;
        const rect = el.getBoundingClientRect();
        if (minViewportRatio > 0) {
          if (rect.width < minWidth || rect.height < minHeight) return false;
        }
        return true;
      })
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const scrollableSpace = Math.max(
          axis === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth,
          0,
        );
        const area = Math.max(el.clientWidth, 1) * Math.max(el.clientHeight, 1);
        return {
          el,
          capacity: scrollableSpace * area,
        };
      })
      .sort((a, b) => b.capacity - a.capacity);
    return scored.length > 0 ? scored[0].el : null;
  };

  const resolveTarget = () => {
    if (preferLargest) return pickLargestScrollable();
    const chain = getChainFromPoint();
    for (const el of chain) {
      if (isScrollable(el)) return el;
    }
    return pickLargestScrollable();
  };

  const target = resolveTarget();
  if (!target || !isScrollable(target)) {
    const reason = preferLargest && minViewportRatio > 0 ? 'no-large-container' : 'no-scrollable-target';
    return { scrolled: false, reason };
  }

  const before = readPosition(target);
  const maxOffset = axis === 'y'
    ? Math.max(target.scrollHeight - target.clientHeight, 0)
    : Math.max(target.scrollWidth - target.clientWidth, 0);
  const boundaryBefore = dir < 0 ? before <= 1 : before >= maxOffset - 1;

  let step = axis === 'y' ? target.clientHeight : target.clientWidth;
  if (!(typeof step === 'number' && Number.isFinite(step) && step > 0)) {
    const fallback = typeof pixelDelta === 'number' && Number.isFinite(pixelDelta) ? pixelDelta : 0;
    step = fallback > 0 ? fallback : Math.max(120, Math.round((axis === 'y' ? window.innerHeight : window.innerWidth) * 0.6));
  }

  const targetPos = toEdge
    ? (dir < 0 ? 0 : maxOffset)
    : Math.min(Math.max(before + dir * step, 0), maxOffset);

  if (axis === 'y') {
    if (typeof target.scrollTo === 'function') {
      target.scrollTo({ top: targetPos, behavior: 'auto' });
    } else {
      target.scrollTop = targetPos;
    }
  } else if (typeof target.scrollTo === 'function') {
    target.scrollTo({ left: targetPos, behavior: 'auto' });
  } else {
    target.scrollLeft = targetPos;
  }

  const after = await waitForScrollSettle(target, before);
  const moved = Math.abs(after - before) > 1;
  const atBoundary = dir < 0 ? after <= 1 : after >= maxOffset - 1;

  return {
    scrolled: moved,
    targetDescription: describeElement(target),
    path: buildPath(target),
    before,
    after,
    atBoundary,
    boundaryBefore,
    maxOffset,
  };
};
