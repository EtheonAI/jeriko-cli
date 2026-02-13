(target) => {
  if (!target || !target.getBoundingClientRect) {
    return { has_canvas: false, intersects_target: false };
  }

  const rect = target.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const canvases = Array.from(document.querySelectorAll('canvas'));
  let intersects = false;
  for (const canvas of canvases) {
    const canvasRect = canvas.getBoundingClientRect();
    if (
      centerX >= canvasRect.left &&
      centerX <= canvasRect.right &&
      centerY >= canvasRect.top &&
      centerY <= canvasRect.bottom
    ) {
      intersects = true;
      break;
    }
  }

  return { has_canvas: canvases.length > 0, intersects_target: intersects };
}
