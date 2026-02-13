/**
 * @param {{action: string, data: any}} args
 * @returns {Promise<[string | null, any]>}
 */
async (args) => {
  const { action, data, timeout } = args
  let origin = window.__manusOrigin
  let postMessageFunc = window.__manusOriginalPostMessage
  if (!postMessageFunc) {
    console.warn('[HelperExtensionBridge] extension initScript not executed, fallback to window.postMessage. This is expected when running extension in dev mode.')
    origin = window.origin
    postMessageFunc = window.postMessage
  }

  if (!origin && action === 'clearMarks') {
    return [null, {}]
  }

  // wait for extension ready
  const readyMark = 'manus-helper-ready'
  if (!document.head.hasAttribute(readyMark)) {
    await new Promise((resolve) => {
      const intervalId = setInterval(() => {
        if (document.head.hasAttribute(readyMark)) {
          clearInterval(intervalId)
          resolve()
        }
      }, 10)
    })
  }

  function genActionId() {
    const base62chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

    const toBase62 = (num) => {
      let result = ''
      do {
        result = base62chars[num % 62] + result
        num = Math.floor(num / 62)
      } while (num > 0)
      return result
    }

    const timestamp = toBase62(Date.now())
    const randomPart = Array.from(
      { length: 3 },
      () => base62chars[Math.floor(Math.random() * 62)]
    ).join('')

    return timestamp + randomPart
  }

  const actionId = genActionId()

  const timeoutMs = timeout * 1000

  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const res = event.data
      // console.log('runExtensionAction: received message', res)
      if (res.type === '__agentActionResult__' && res.actionId === actionId) {
        // console.log('runExtensionAction: action result matched', res)
        window.removeEventListener('message', onMessage)
        clearTimeout(timeoutId)
        if (res.error) {
          resolve([res.error, null])
        } else {
          resolve([null, res])
        }
      }
    }

    // handle timeout
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', onMessage)
      resolve(['Operation timed out', null])
    }, timeoutMs)

    window.addEventListener('message', onMessage)
    // console.log('runExtensionAction: posting agent action', { actionId, action, ...data })

    if (origin === 'null') {
      postMessageFunc({
        type: '__agentAction__',
        actionId,
        action,
        ...data
      })
    } else {
      postMessageFunc({
        type: '__agentAction__',
        actionId,
        action,
        ...data
      }, origin)
    }
  })
}
