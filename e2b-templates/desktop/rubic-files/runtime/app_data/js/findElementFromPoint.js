([x, y]) => {
  const element = document.elementFromPoint(x, y);
  if (!element) return null;

  // 检查元素是否可输入
  const isInputable = element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.isContentEditable ||
    element.getAttribute('contenteditable') === 'true';

  if (!isInputable) return null;

  // 为元素添加一个唯一的标识符
  const uniqueId = 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  element.setAttribute('data-playwright-temp-id', uniqueId);

  return uniqueId;
}