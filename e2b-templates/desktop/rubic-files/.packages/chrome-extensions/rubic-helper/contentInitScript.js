if (!window.__manusOriginalPostMessage) {
  window.__manusOriginalPostMessage = window.postMessage
  window.__manusOrigin = window.origin
  // console.log('postMessage protected', window.__manusOriginalPostMessage, window.__manusOrigin)
}
