({
  startIndex,
  clickFlagAttr,
  clickIdAttr,
}) => {
  const elements = [];
  let index = startIndex;
  const interactiveTags = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary', 'option', 'canvas']);
  const interactiveRoles = new Set([
    'button',
    'tab',
    'link',
    'checkbox',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'radio',
  ]);

  const normalizeText = (value, limit = 120) => {
    if (!value) {
      return '';
    }
    const trimmed = value.replace(/\s+/g, ' ').trim();
    if (!trimmed) {
      return '';
    }
    if (trimmed.length > limit) {
      return `${trimmed.slice(0, limit)}...`;
    }
    return trimmed;
  };

  const buildDescription = (el, tagName, text, inputType) => {
    const hints = [];
    const idValue = normalizeText(el.id, 60);
    if (idValue) {
      hints.push(`id:"${idValue}"`);
    }
    const ariaLabel = normalizeText(el.getAttribute('aria-label') || el.title || '', 80);
    if (ariaLabel) {
      hints.push(`hint:"${ariaLabel}"`);
    }
    const placeholder = normalizeText(el.getAttribute('placeholder') || '', 80);
    if (placeholder) {
      hints.push(`placeholder:"${placeholder}"`);
    }
    const role = normalizeText(el.getAttribute('role') || '', 40);
    if (role) {
      hints.push(`role:"${role}"`);
    }
    if (inputType) {
      hints.push(`type:"${inputType}"`);
    }
    const hintText = hints.length ? `{${hints.join(',')}}` : '{}';
    if (text) {
      return `${tagName} ${hintText} ${text}`.trim();
    }
    return `${tagName} ${hintText}`.trim();
  };

  const getPrimaryText = (el, tagName, inputType) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (el.value) {
        return normalizeText(el.value);
      }
      if (el.placeholder) {
        return normalizeText(el.placeholder);
      }
    }
    if (tagName === 'option' && el instanceof HTMLOptionElement) {
      return normalizeText(el.innerText || el.textContent || '');
    }
    if (tagName === 'select' && el instanceof HTMLSelectElement) {
      const options = Array.from(el.options || []).slice(0, 5);
      const optionTexts = options
        .map((opt, idx) => {
          const val = normalizeText(opt.textContent || '');
          if (!val) {
            return null;
          }
          return `option#${idx}:${val}`;
        })
        .filter(Boolean);
      if (optionTexts.length) {
        return optionTexts.join(', ');
      }
    }
    const text = normalizeText(el.innerText || el.textContent || '');
    if (text) {
      return text;
    }
    if (inputType === 'submit' || inputType === 'button') {
      return normalizeText(el.value || 'submit');
    }
    return '';
  };

  const isProbablyClickable = (el, tagName) => {
    if (el.hasAttribute(clickFlagAttr)) {
      return true;
    }
    if (interactiveTags.has(tagName)) {
      return true;
    }
    const role = (el.getAttribute('role') || '')
      .split(' ')
      .map((r) => r.trim().toLowerCase());
    if (role.some((r) => interactiveRoles.has(r))) {
      return true;
    }
    const contentEditable = el.getAttribute('contenteditable');
    if (contentEditable && contentEditable.toLowerCase() !== 'false') {
      return true;
    }
    return false;
  };

  const isVisible = (el, rect) => {
    if (!rect || rect.width <= 1 || rect.height <= 1) {
      return false;
    }
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
      return false;
    }
    if (style.pointerEvents === 'none') {
      return false;
    }
    const opacity = Number.parseFloat(style.opacity || '1');
    if (!Number.isNaN(opacity) && opacity <= 0) {
      return false;
    }
    return true;
  };

  const seen = new Set();
  const traverse = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      if (node instanceof HTMLElement && !seen.has(node)) {
        seen.add(node);
        const tagName = node.tagName.toLowerCase();
        if (isProbablyClickable(node, tagName)) {
          const rect = node.getBoundingClientRect();
          if (isVisible(node, rect)) {
            const inputTypeRaw = tagName === 'input' ? node.getAttribute('type') || 'text' : null;
            const inputType = inputTypeRaw ? inputTypeRaw.toLowerCase() : null;
            const text = getPrimaryText(node, tagName, inputType);
            const description = buildDescription(node, tagName, text, inputType);
            node.setAttribute(clickIdAttr, String(index));
            elements.push({
              index,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              tag: tagName,
              inputType,
              description,
            });
            index += 1;
          }
        }
        if (node.shadowRoot) {
          traverse(node.shadowRoot);
        }
      }
      node = walker.nextNode();
    }
  };
  traverse(document);

  return {
    elements,
    nextIndex: index,
    viewport: {
      width: window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : null),
      height: window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : null),
      devicePixelRatio: window.devicePixelRatio || 1,
    },
  };
}
