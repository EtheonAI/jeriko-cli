(checkHeight) => {
  const allElements = document.body.getElementsByTagName('*');
  for (let el of allElements) {
    // 排除容器元素
    if (el.tagName === 'HTML' || el.tagName === 'BODY') {
      continue;
    }
    
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    
    // 元素必须可见且有实际尺寸
    if (style.display !== 'none' && 
        style.visibility !== 'hidden' && 
        rect.height > 0 && 
        rect.width > 0 && 
        rect.bottom >= checkHeight) {
      
      // 检测实际内容元素：排除纯布局容器
      const hasDirectText = el.childNodes && Array.from(el.childNodes).some(node => 
        node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
      );
      const isContentElement = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'STRONG', 'EM', 'I', 'B'].includes(el.tagName);
      const isImportantElement = ['IMG', 'SVG', 'CANVAS', 'VIDEO', 'IFRAME', 'TABLE', 'TR', 'TD', 'TH'].includes(el.tagName);
      
      // 只检测有直接文本内容的元素或重要的内容元素
      // 对于IMG元素，检查实际渲染尺寸
      let elementBottom = rect.bottom;
      if (el.tagName === 'IMG') {
        const objectFit = style.objectFit;
        if (objectFit === 'cover' && el.naturalWidth && el.naturalHeight && rect.width && rect.height) {
          const containerRatio = rect.width / rect.height;
          const imageRatio = el.naturalWidth / el.naturalHeight;
          
          if (imageRatio !== containerRatio && imageRatio < containerRatio) {
            // 图片更高，实际渲染高度更大
            const actualHeight = rect.width / imageRatio;
            elementBottom = rect.top + actualHeight;
          }
        }
      }
      
      if ((hasDirectText || isContentElement || isImportantElement) && elementBottom >= checkHeight) {
        return true;
      }
    }
  }
  return false;
}

