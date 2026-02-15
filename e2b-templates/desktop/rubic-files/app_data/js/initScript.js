(function () {
  if (window.__rubicInitScriptExecuted) {
    return
  }
  window.__rubicInitScriptExecuted = true
  // console.log('init script started')

  // Webdriver property
  //Object.defineProperty(navigator, 'webdriver', {
  //	get: () => undefined
  //});

  delete Object.getPrototypeOf(navigator).webdriver

  // Languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US']
  });

  // Plugins
  //Object.defineProperty(navigator, 'plugins', {
  //	get: () => [1, 2, 3, 4, 5]
  //});

  // Chrome runtime
  //window.chrome = { runtime: {} };

  // Permissions
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) => (
    parameters.name === 'notifications' ?
      Promise.resolve({ state: Notification.permission }) :
      originalQuery(parameters)
  );

  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function attachShadow(options) {
    return originalAttachShadow.call(this, { ...options, mode: "open" });
  };

  // Protect postMessage
  if (!window.__rubicOriginalPostMessage) {
    window.__rubicOriginalPostMessage = window.postMessage
    window.__rubicOrigin = window.origin
    // console.log('postMessage protected', window.__rubicOriginalPostMessage, window.__rubicOrigin)
  }

  // console.log('init script end')
})();

