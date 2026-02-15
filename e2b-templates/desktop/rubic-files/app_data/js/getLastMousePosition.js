(() => {
  if (!window.__rubicMouseTrackerInstalled) {
    window.__rubicMouseTrackerInstalled = true;
    window.__rubicLastMousePosition = null;
    window.addEventListener(
      'pointermove',
      (e) => { window.__rubicLastMousePosition = { x: e.clientX, y: e.clientY }; },
      { passive: true },
    );
  }
  return window.__rubicLastMousePosition;
})();
