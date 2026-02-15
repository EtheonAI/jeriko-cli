() => {
  // 构建元素树结构
  function buildElementTree() {
    const allElements = [];
    
    function processElement(el, parent = null, depth = 0) {
      // 统一使用大写进行比较
      const tagNameUpper = el.tagName.toUpperCase();
      if (tagNameUpper === 'HTML' || tagNameUpper === 'BODY') {
        // 继续处理子元素，但不记录body本身
        const children = [];
        for (let child of el.children) {
          const childData = processElement(child, el, depth);
          if (childData) {
            children.push(childData);
          }
        }
        return children.length > 0 ? { tag: 'BODY', children: children } : null;
      }
      
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      
      // 判断是否为重要元素（需要特殊处理）
      // tagNameUpper 已在函数开头定义
      const isImportant = ['IMG', 'SVG', 'CANVAS', 'VIDEO', 'IFRAME', 'TABLE', 'TR', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagNameUpper);
      
      // 对于 SVG 等元素，即使 getBoundingClientRect() 返回 0，也可能有实际的尺寸属性
      let hasValidSize = rect.height > 0 && rect.width > 0;
      if (!hasValidSize && (tagNameUpper === 'SVG' || tagNameUpper === 'CANVAS')) {
        // 检查 SVG/CANVAS 的属性尺寸
        const attrWidth = el.getAttribute('width');
        const attrHeight = el.getAttribute('height');
        const viewBox = el.getAttribute('viewBox');
        if (attrWidth && attrHeight) {
          const width = parseFloat(attrWidth);
          const height = parseFloat(attrHeight);
          if (width > 0 && height > 0) {
            hasValidSize = true;
          }
        } else if (viewBox) {
          // 如果有 viewBox，也认为有有效尺寸
          const viewBoxValues = viewBox.split(/[\s,]+/).map(v => parseFloat(v));
          if (viewBoxValues.length >= 4 && viewBoxValues[2] > 0 && viewBoxValues[3] > 0) {
            hasValidSize = true;
          }
        }
      }
      
      // 只处理可见且有尺寸的元素（重要元素即使尺寸为0也可能需要记录）
      if (style.display === 'none' || (!hasValidSize && !isImportant)) {
        return null;
      }
      
      // 获取直接文本内容（不包括子元素的文本）
      let directText = '';
      for (let node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim();
          if (text) {
            directText += text + ' ';
          }
        }
      }
      directText = directText.trim();
      
      // 先处理子元素，再决定是否记录当前元素
      const children = [];
      for (let child of el.children) {
        const childData = processElement(child, el, depth + 1);
        if (childData) {
          children.push(childData);
        }
      }
      
      // 检查是否有有意义的子元素
      const hasImportantChildren = children.length > 0;
      
      // 判断是否需要记录此元素（isImportant 已在前面定义）
      const hasDirectText = directText.length > 0;
      // 安全地获取 className：对于 SVG 元素，className 可能是 SVGAnimatedString，需要使用 .baseVal
      let classNameStr = '';
      if (el.className) {
        if (typeof el.className === 'string') {
          classNameStr = el.className;
        } else if (el.className.baseVal !== undefined) {
          // SVGAnimatedString 类型
          classNameStr = el.className.baseVal;
        } else {
          classNameStr = String(el.className);
        }
      }
      const hasClassName = classNameStr.trim().length > 0;
      
      // 记录规则：重要元素、有直接文本的叶子节点、有class的容器节点
      const shouldRecord = isImportant || (hasDirectText && !hasImportantChildren) || (!hasDirectText && hasImportantChildren && hasClassName);
      
      if (!shouldRecord && !hasImportantChildren) {
        return null;
      }
      
      // 计算IMG的实际渲染尺寸
      let actualBottom = rect.bottom;
      if (tagNameUpper === 'IMG') {
        const objectFit = style.objectFit;
        if (objectFit === 'cover' && el.naturalWidth && el.naturalHeight && rect.width && rect.height) {
          const containerRatio = rect.width / rect.height;
          const imageRatio = el.naturalWidth / el.naturalHeight;
          if (imageRatio !== containerRatio && imageRatio < containerRatio) {
            const actualHeight = rect.width / imageRatio;
            actualBottom = rect.top + actualHeight;
          }
        }
      }
      
      // 获取父元素信息（安全处理 className）
      let parentClassNameStr = '';
      if (parent && parent.className) {
        if (typeof parent.className === 'string') {
          parentClassNameStr = parent.className;
        } else if (parent.className.baseVal !== undefined) {
          parentClassNameStr = parent.className.baseVal;
        } else {
          parentClassNameStr = String(parent.className);
        }
      }
      const parentInfo = parent ? (parentClassNameStr || parent.id || parent.tagName) : null;
      
      const elementData = {
        tag: el.tagName,
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        actualBottom: tagNameUpper === 'IMG' ? Math.round(actualBottom) : Math.round(rect.bottom),
        height: Math.round(rect.height),
        width: Math.round(rect.width),
        className: classNameStr,
        id: el.id || '',
        directText: directText || (tagNameUpper === 'IMG' ? (el.alt || 'no alt') : ''),
        depth: depth,
        parent: parentInfo,
        children: children
      };
      
      allElements.push(elementData);
      return elementData;
    }
    
    const root = processElement(document.body);
    // 如果root是BODY包装器，返回其第一个子节点作为实际根，否则返回root
    if (root && root.tag === 'BODY' && root.children && root.children.length > 0) {
      // 如果有多个顶层元素，创建一个虚拟根节点
      if (root.children.length === 1) {
        return root.children[0];
      } else {
        return { tag: 'ROOT', children: root.children };
      }
    }
    return root;
  }
  
  // 扁平化树结构用于排序
  function flattenTree(node, result = []) {
    if (!node) return result;
    result.push(node);
    for (let child of node.children) {
      flattenTree(child, result);
    }
    return result;
  }
  
  const tree = buildElementTree();
  const flatElements = flattenTree(tree);
  
  // 获取body和html的尺寸作为参考
  const bodyRect = document.body.getBoundingClientRect();
  const htmlRect = document.documentElement.getBoundingClientRect();
  
  return {
    elements: flatElements,
    tree: tree,
    bodyHeight: Math.round(bodyRect.height),
    htmlHeight: Math.round(htmlRect.height),
    viewportHeight: window.innerHeight
  };
}
