(index) => {
  const attr = 'data-manus_click_id';
  const target = String(index);
  const visited = new Set();
  const MAX_DEPTH = 10;

  const walk = (root, depth = 0) => {
    if (!root || depth > MAX_DEPTH) {
      return null;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();

    while (node) {
      if (node instanceof Element && node.getAttribute(attr) === target) {
        return node;
      }
      if (node instanceof Element && node.shadowRoot) {
        const found = walk(node.shadowRoot, depth + 1);
        if (found) {
          return found;
        }
      }
      node = walker.nextNode();
    }
    return null;
  };

  const searchFrames = (doc, depth = 0) => {
    if (!doc || depth > MAX_DEPTH) {
      return null;
    }
    const foundInDoc = walk(doc, depth);
    if (foundInDoc) {
      return foundInDoc;
    }
    const frames = doc.querySelectorAll('iframe, frame');
    for (const frame of frames) {
      if (!(frame instanceof HTMLIFrameElement || frame instanceof HTMLFrameElement)) {
        continue;
      }
      if (visited.has(frame)) {
        continue;
      }
      visited.add(frame);
      try {
        const childDoc = frame.contentDocument;
        const found = searchFrames(childDoc, depth + 1);
        if (found) {
          return found;
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  };

  return searchFrames(document, 0);
};
