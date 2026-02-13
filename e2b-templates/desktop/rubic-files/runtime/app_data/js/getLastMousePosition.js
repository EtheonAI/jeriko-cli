(() => {
  if (!window.__manusMouseTrackerInstalled) {
    window.__manusMouseTrackerInstalled = true;
    window.__manusLastMousePosition = null;
    window.addEventListener(
      'pointermove',
      (e) => { window.__manusLastMousePosition = { x: e.clientX, y: e.clientY }; },
      { passive: true },
    );
  }
  return window.__manusLastMousePosition;
})();
