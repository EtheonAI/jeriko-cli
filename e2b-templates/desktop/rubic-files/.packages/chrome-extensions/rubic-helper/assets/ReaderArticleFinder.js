window.originalNodePrototypes = {
  Node: {
    cloneNode: Node.prototype.cloneNode,
  },
};

(() => {
  const MAX_NODES = 5000

  // disable all logs
  const console = {
    ...window.console,
    log: () => { },
  }

  function hostnameMatchesHostKnownToContainEmbeddableMedia(e) {
    return /^(.+\.)?(youtube(-nocookie)?\.com|vimeo\.com|dailymotion\.com|soundcloud\.com|mixcloud\.com|embedly\.com|embed\.ly)\.?$/.test(
      e,
    )
  }

  function lazyLoadingImageURLForElement(e, t) {
    function n(e) {
      const t = /\.(jpe?g|png|gif|bmp)$/i
      if (t.test(e)) {
        return true
      }
      let n = urlFromString(e)
      return !!n && t.test(n.pathname)
    }
    function r(e) {
      let t = attributesForElement(e)
      for (let r of t) {
        let t = r.name
        if (a.has(t.toLowerCase())) {
          return e.getAttribute(t)
        }
        let i = n(r.value)
        if (o.has(t.toLowerCase()) && i) {
          return e.getAttribute(t)
        }
        if (s && /^data.*(src|source)$/i.test(t) && i) {
          return e.getAttribute(t)
        }
        if (
          e instanceof HTMLImageElement &&
          /^data-/.test(t) &&
          i &&
          e.naturalWidth === 1 &&
          e.naturalHeight === 1
        ) {
          return e.getAttribute(t)
        }
      }
    }
    const i =
      /(data:image\/)?gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==/
    const a = new Set([
      'data-lazy-src',
      'data-original',
      'datasrc',
      'data-src',
      'original-src',
      'rel:bf_image_src',
      'deferred-src',
      'data-mediaviewer-src',
      'data-hi-res-src',
      'data-native-src',
    ])
    const o = new Set(['original'])
    let l = e.getAttribute('src')
    let s = /transparent|empty/i.test(l) || i.test(l)
    const c = 2
    for (let t = e, n = 0; t && n < c; t = t.parentElement, ++n) {
      let e = r(t)
      if (e) {
        return e
      }
    }
    let u = e.closest('*[itemscope]')
    if (
      u &&
      /^https?:\/\/schema\.org\/ImageObject\/?$/.test(u.getAttribute('itemtype'))
    ) {
      let e = u.getAttribute('itemid')
      if (n(e) && !u.querySelector('img')) {
        return e
      }
    }
    if (LazyLoadRegex.test(t) && typeof URL == 'function') {
      var m
      try {
        m = new URL(e.src)
      } catch (e) { }
      if (m && m.search) {
        var d
        var h
        const t = ['w', 'width']
        for (var g = t.length, f = 0; f < g; ++f) {
          var p = t[f]
          var E = m.searchParams.get(p)
          if (E && !isNaN(parseInt(E))) {
            d = p
            break
          }
        }
        const n = ['h', 'height']
        var v = n.length
        for (f = 0; f < v; ++f) {
          var N = n[f]
          var A = m.searchParams.get(N)
          if (A && !isNaN(parseInt(A))) {
            h = N
            break
          }
        }
        if (d && h) {
          var S = e.getAttribute('width')
          var C = e.getAttribute('height')
          if (!isNaN(parseInt(S)) && !isNaN(parseInt(C))) {
            m.searchParams.set(d, S)
            m.searchParams.set(h, C)
            return m.href
          }
        }
      }
    }
    return null
  }
  function sanitizeElementByRemovingAttributes(e) {
    if (elementLooksLikeEmbeddedIframeTweetWithSrc(e)) {
      e.setAttribute('height', e.style.height)
      e.setAttribute('width', e.style.width)
    }
    const t = /^on|^id$|^class$|^style$|^autofocus$/
    for (var n = attributesForElement(e), r = 0; r < n.length; ++r) {
      var i = n[r].nodeName
      if (t.test(i)) {
        e.removeAttribute(i)
        r--
      }
    }
  }
  function characterAppearsToBeCJK(e) {
    if (!e || e.length === 0) {
      return false
    }
    var t = e.charCodeAt(0)
    return (
      (t > 11904 && t < 12031) ||
      (t > 12352 && t < 12543) ||
      (t > 12736 && t < 19903) ||
      (t > 19968 && t < 40959) ||
      (t > 44032 && t < 55215) ||
      (t > 63744 && t < 64255) ||
      (t > 65072 && t < 65103) ||
      (t > 131072 && t < 173791) ||
      (t > 194560 && t < 195103)
    )
  }
  function domDistance(e, t, n) {
    for (var r = [], i = e; i;) {
      r.unshift(i)
      i = i.parentNode
    }
    var a = []
    for (i = t; i;) {
      a.unshift(i)
      i = i.parentNode
    }
    for (
      var o = Math.min(r.length, a.length),
      l = Math.abs(r.length - a.length),
      s = o;
      s >= 0 && r[s] !== a[s];
      --s
    ) {
      l += 2
      if (n && l >= n) {
        return n
      }
    }
    return l
  }
  function fontSizeFromComputedStyle(e, t) {
    var n = parseInt(e.fontSize)
    if (isNaN(n)) {
      n = t || BaseFontSize
    }
    return n
  }
  function contentTextStyleForNode(e, t) {
    function n(e) {
      if (isNodeWhitespace(e)) {
        return null
      }
      var t = getComputedStyle(e.parentNode)
      if (t.float !== 'none') {
        return null
      } else {
        return t
      }
    }
    for (
      var r =
        'descendant::text()[not(parent::h1) and not(parent::h2) and not(parent::h3) and not(parent::h4) and not(parent::h5) and not(parent::h6)]',
      i = e.evaluate(r, t, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null),
      a = i.snapshotLength,
      o = 0;
      o < a;
      ++o
    ) {
      for (
        var l = i.snapshotItem(o), s = false, c = l.parentElement;
        c !== t;
        c = c.parentElement
      ) {
        if (NegativeRegEx.test(c.className)) {
          s = true
          break
        }
      }
      if (!s) {
        var u = n(l)
        if (u) {
          return u
        }
      }
    }
    return null
  }
  function isNodeWhitespace(e) {
    return !(!e || e.nodeType !== Node.TEXT_NODE) && !/\S/.test(e.data)
  }
  function removeWhitespace(e) {
    return e.replace(/\s+/g, '')
  }
  function isElementNode(e) {
    return !(!e || e.nodeType !== Node.ELEMENT_NODE)
  }
  function computedStyleIndicatesElementIsInvisibleDueToClipping(e) {
    if (e.position !== 'absolute') {
      return false
    }
    var t = e.clip.match(
      /^rect\((\d+px|auto), (\d+px|auto), (\d+px|auto), (\d+px|auto)\)$/,
    )
    if (!t || t.length !== 5) {
      return false
    }
    var n = t.map(function (e) {
      return parseInt(e)
    })
    var r = n[1]
    if (isNaN(r)) {
      r = 0
    }
    var i = n[2]
    var a = n[3]
    var o = n[4]
    if (isNaN(o)) {
      o = 0
    }
    return r >= a || i >= o
  }
  function isElementVisible(e) {
    var t = getComputedStyle(e)
    if (t.visibility !== 'visible' || t.display === 'none') {
      return false
    }
    if (cachedElementBoundingRect(e).height) {
      return true
    }
    var n = document.createRange()
    n.selectNode(e)
    return !!n.getBoundingClientRect().height
  }
  function isElementPositionedOffScreen(e) {
    var t = cachedElementBoundingRect(e)
    return !(!t.height || !t.width) && (t.bottom <= 0 || t.right <= 0)
  }
  function elementDepth(e) {
    for (var t = 0; e; e = e.parentElement) {
      t++
    }
    return t
  }
  function depthOfElementWithinElement(e, t) {
    for (var n = 0; e !== t; e = e.parentElement) {
      if (!e) {
        return NaN
      }
      n++
    }
    return n
  }
  function nearestAncestorElementWithTagName(e, t, n) {
    var r = {}
    if (n) {
      for (var i = 0; i < n.length; ++i) {
        r[n[i]] = true
      }
    }
    if (r[normalizedElementTagName(e)]) {
      return null
    }
    for (; (e = e.parentElement);) {
      var a = normalizedElementTagName(e)
      if (r[a]) {
        break
      }
      if (a === t) {
        return e
      }
    }
    return null
  }
  function elementDescendsFromElementMatchingSelector(e, t) {
    do {
      if (e.matches(t)) {
        return true
      }
    } while ((e = e.parentElement))
    return false
  }
  function elementDescendsFromElementInSet(e, t) {
    do {
      if (t.has(e)) {
        return true
      }
    } while ((e = e.parentElement))
    return false
  }
  function cachedElementBoundingRect(e) {
    if (e._cachedElementBoundingRect) {
      return e._cachedElementBoundingRect
    }
    var t = e.getBoundingClientRect()
    ReaderArticleFinderJS._elementsWithCachedBoundingRects.push(e)
    if (
      ReaderArticleFinderJS._cachedScrollX ||
      ReaderArticleFinderJS._cachedScrollY
    ) {
      e._cachedElementBoundingRect = {
        top: t.top + ReaderArticleFinderJS._cachedScrollY,
        right: t.right + ReaderArticleFinderJS._cachedScrollX,
        bottom: t.bottom + ReaderArticleFinderJS._cachedScrollY,
        left: t.left + ReaderArticleFinderJS._cachedScrollX,
        width: t.width,
        height: t.height,
      }
      return e._cachedElementBoundingRect
    } else {
      e._cachedElementBoundingRect = t
      return e._cachedElementBoundingRect
    }
  }
  function clearCachedElementBoundingRects() {
    for (
      var e = ReaderArticleFinderJS._elementsWithCachedBoundingRects,
      t = e.length,
      n = 0;
      n < t;
      ++n
    ) {
      e[n]._cachedElementBoundingRect = null
    }
    ReaderArticleFinderJS._elementsWithCachedBoundingRects = []
  }
  function trimmedInnerTextIgnoringTextTransform(e) {
    var t = e.innerText
    if (!/\S/.test(t)) {
      return e.textContent.trim()
    }
    var n = getComputedStyle(e).textTransform
    if (n === 'uppercase' || n === 'lowercase') {
      return e.textContent.trim()
    } else if (t) {
      return t.trim()
    } else {
      return ''
    }
  }
  function levenshteinDistance(e, t) {
    for (
      var n = e.length, r = t.length, i = new Array(n + 1), a = 0;
      a < n + 1;
      ++a
    ) {
      i[a] = new Array(r + 1)
      i[a][0] = a
    }
    for (var o = 0; o < r + 1; ++o) {
      i[0][o] = o
    }
    for (o = 1; o < r + 1; ++o) {
      for (a = 1; a < n + 1; ++a) {
        if (e[a - 1] === t[o - 1]) {
          i[a][o] = i[a - 1][o - 1]
        } else {
          var l = i[a - 1][o] + 1
          var s = i[a][o - 1] + 1
          var c = i[a - 1][o - 1] + 1
          i[a][o] = Math.min(l, s, c)
        }
      }
    }
    return i[n][r]
  }
  function stringSimilarity(e, t) {
    var n = Math.max(e.length, t.length)
    if (n) {
      return (n - levenshteinDistance(e, t)) / n
    } else {
      return 0
    }
  }
  function stringsAreNearlyIdentical(e, t) {
    return (
      e === t ||
      stringSimilarity(e, t) > StringSimilarityToDeclareStringsNearlyIdentical
    )
  }
  function elementIsCommentBlock(e) {
    if (/(^|\s)comment/.test(e.className)) {
      return true
    }
    var t = e.getAttribute('id')
    return !(!t || (t.indexOf('comment') !== 0 && t.indexOf('Comment') !== 0))
  }
  function elementLooksLikeEmbeddedTweet(e) {
    var t = null
    if (normalizedElementTagName(e) === 'iframe') {
      if (!e.contentDocument) {
        return elementLooksLikeEmbeddedIframeTweetWithSrc(e)
      }
      t = e.contentDocument.documentElement
    } else if (normalizedElementTagName(e) === 'twitter-widget') {
      t = e.shadowRoot
    }
    if (!t) {
      return false
    }
    if (e.closest('.twitter-video') && t.querySelector('[data-tweet-id]')) {
      return true
    }
    let n = 0
    let r = t.querySelector('blockquote')
    if (r && TweetURLRegex.test(r.getAttribute('cite'))) {
      ++n
    }
    let i = t.querySelector('[data-iframe-title]')
    if (i && TweetIframeTitleRegex.test(i.getAttribute('data-iframe-title'))) {
      ++n
    }
    if (e.classList.contains('twitter-tweet')) {
      ++n
    }
    if (t.querySelector('[data-tweet-id]')) {
      ++n
    }
    return n > 2
  }
  function elementLooksLikeEmbeddedIframeTweetWithSrc(e) {
    return (
      EmbeddedTwitterIframeSrcRegEx.test(e.getAttribute('src')) &&
      e.getAttribute('title') === 'Twitter Tweet'
    )
  }
  function elementLooksLikeACarousel(e) {
    const t = /carousel-|carousel_|-carousel|_carousel|swiper-/
    return t.test(e.className) || t.test(e.getAttribute('data-analytics'))
  }
  function elementLooksLikePartOfACarousel(e) {
    const t = 3
    for (var n = e, r = 0; r < t; ++r) {
      if (!n) {
        return false
      }
      if (elementLooksLikeACarousel(n)) {
        return true
      }
      n = n.parentElement
    }
    return false
  }
  function urlIsHTTPFamilyProtocol(e) {
    let t = e.protocol
    return t === 'http:' || t === 'https:'
  }
  function shouldPruneIframe(e) {
    if (e.srcdoc) {
      return true
    }
    let t = urlFromString(e.src)
    if (t) {
      if (!urlIsHTTPFamilyProtocol(t)) {
        return true
      }
      if (hostnameMatchesHostKnownToContainEmbeddableMedia(t.hostname)) {
        return false
      }
    }
    return !elementLooksLikeEmbeddedTweet(e.originalElement)
  }
  function textContentAppearsToBeCJK(e, t) {
    if (!e || !e.length) {
      return false
    }
    let n = e.length
    if (t && !isNaN(t)) {
      n = Math.min(n, t)
    }
    let r = 0
    for (let t = 0; t < n; t++) {
      if (characterAppearsToBeCJK(e[t])) {
        r++
      }
    }
    return r >= n * MinimumRatioOfCharactersForLanguageMultiplier
  }
  function languageScoreMultiplierForTextNodes(e) {
    if (!e || !e.length) {
      return 1
    }
    for (
      var t = Math.min(
        e.length,
        DefaultNumberOfTextNodesToCheckForLanguageMultiplier,
      ),
      n = 0,
      r = 0,
      i = 0;
      i < t;
      i++
    ) {
      for (
        var a = e[i].nodeValue.trim(),
        o = Math.min(
          a.length,
          NumberOfCharactersPerTextNodeToEvaluateForLanguageMultiplier,
        ),
        l = 0;
        l < o;
        l++
      ) {
        if (characterAppearsToBeCJK(a[l])) {
          n++
        }
      }
      r += o
    }
    if (n >= r * MinimumRatioOfCharactersForLanguageMultiplier) {
      return ScoreMultiplierForChineseJapaneseKorean
    } else {
      return 1
    }
  }
  function scoreMultiplierForElementTagNameAndAttributes(e) {
    for (var t = 1, n = e; n; n = n.parentElement) {
      var r = n.getAttribute('id')
      if (r) {
        if (ArticleRegEx.test(r)) {
          t += ArticleMatchBonus
        }
        if (CommentRegEx.test(r)) {
          t -= CommentMatchPenalty
        }
        if (CarouselRegEx.test(r)) {
          t -= CarouselMatchPenalty
        }
      }
      var i = n.className
      if (i) {
        if (ArticleRegEx.test(i)) {
          t += ArticleMatchBonus
        }
        if (CommentRegEx.test(i)) {
          t -= CommentMatchPenalty
        }
        if (CarouselRegEx.test(i)) {
          t -= CarouselMatchPenalty
        }
      }
      if (normalizedElementTagName(n) === 'article') {
        t += ArticleMatchBonus
      }
    }
    if (t < 0) {
      return 0
    } else {
      return t
    }
  }
  function elementAtPoint(e, t, n) {
    if (
      typeof ReaderArticleFinderJSController != 'undefined' &&
      ReaderArticleFinderJSController.nodeAtPoint
    ) {
      var r = ReaderArticleFinderJSController.nodeAtPoint(e, t)
      if (r && r.nodeType !== Node.ELEMENT_NODE) {
        r = r.parentElement
      }
      return r
    }
    return n.elementFromPoint(e, t)
  }
  function userVisibleURLString(e) {
    if (
      typeof ReaderArticleFinderJSController != 'undefined' &&
      ReaderArticleFinderJSController.userVisibleURLString
    ) {
      return ReaderArticleFinderJSController.userVisibleURLString(e)
    } else {
      return e
    }
  }
  function urlFromString(e, t) {
    try {
      if (t != null) {
        return new URL(e, t)
      } else {
        return new URL(e)
      }
    } catch (e) {
      return null
    }
  }
  function urlStringShouldHaveItsAnchorMadeNonFunctional(e, t) {
    if (!e) {
      return true
    }
    var n = urlFromString(e)
    if (!n) {
      n = urlFromString(e, t)
    }
    if (!n || !n.href || !n.href.length) {
      return true
    }
    let r = n.href
    return (
      r.trim().substring(0, 11).toLowerCase() === 'javascript:' ||
      r.trim().substring(0, 5).toLowerCase() === 'data:'
    )
  }
  function anchorLinksToAttachment(e) {
    return /\battachment\b/i.test(e.getAttribute('rel'))
  }
  function anchorLinksToTagOrCategoryPage(e) {
    return /\bcategory|tag\b/i.test(e.getAttribute('rel'))
  }
  function anchorLooksLikeDownloadFlashLink(e) {
    return /^https?:\/\/(www\.|get\.)(adobe|macromedia)\.com\/(((products|[a-zA-Z]{1,2}|)\/flashplayer|flashplayer|go\/getflash(player)?)|(shockwave\/download\/(index|download)\.cgi\?P1_Prod_Version=ShockwaveFlash)\/?$)/i.test(
      e.href,
    )
  }
  function elementsHaveSameTagAndClassNames(e, t) {
    return (
      normalizedElementTagName(e) === normalizedElementTagName(t) &&
      e.className === t.className
    )
  }
  function selectorForElement(e) {
    let t = normalizedElementTagName(e)
    for (var n = e.classList, r = n.length, i = 0; i < r; i++) {
      t += '.' + n[i]
    }
    return t
  }
  function elementFingerprintForDepth(e, t) {
    function n(e, t) {
      if (!e) {
        return ''
      }
      var o = []
      o.push(selectorForElement(e))
      var l = e.children
      var s = l.length
      if (s && t > 0) {
        o.push(r)
        for (var c = 0; c < s; ++c) {
          o.push(n(l[c], t - 1))
          if (c !== s - 1) {
            o.push(a)
          }
        }
        o.push(i)
      }
      return o.join('')
    }
    const r = ' / '
    const i = ' \\'
    const a = ' | '
    return n(e, t)
  }
  function childrenOfParentElement(e) {
    var t = e.parentElement
    if (t) {
      return t.children
    } else {
      return []
    }
  }
  function arrayOfKeysAndValuesOfObjectSortedByValueDescending(obj) {
    var t = []
    for (var n in obj) {
      if (obj.hasOwnProperty(n)) {
        t.push({
          key: n,
          value: obj[n],
        })
      }
    }
    t.sort(function (e, t) {
      return t.value - e.value
    })
    return t
  }
  function walkElementSubtree(node, t, fn) {
    if (t >= 0) {
      for (var r = node.children, i = r.length, a = t - 1, o = 0; o < i; ++o) {
        let aborted = walkElementSubtree(r[o], a, fn)
        if (aborted === true) {
          break
        }
      }
      fn(node, t)
    }
  }
  function elementIndicatesItIsASchemaDotOrgArticleContainer(e) {
    var t = e.getAttribute('itemtype')
    return /^https?:\/\/schema\.org\/((News)?Article|APIReference)$/.test(t)
  }
  function elementIndicatesItIsASchemaDotOrgImageObject(e) {
    var t = e.getAttribute('itemtype')
    return (
      t === 'https://schema.org/ImageObject' ||
      t === 'http://schema.org/ImageObject'
    )
  }
  function elementWouldAppearBetterAsFigureOrAuxiliary(e, t) {
    const n = /caption/i
    if (!e) {
      return false
    }
    if (t.closest('figure, .auxiliary')) {
      return false
    }
    if (
      elementIndicatesItIsASchemaDotOrgImageObject(e) &&
      !t.querySelector('figure, .auxiliary')
    ) {
      return true
    }
    var r = t.ownerDocument.createTreeWalker(
      t,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: function () {
          return NodeFilter.FILTER_ACCEPT
        },
      },
    )
    r.currentNode = t
    for (var i = false, a = false; r.nextNode();) {
      var o = r.currentNode
      if (o.nodeType === Node.TEXT_NODE) {
        if (!i && /\S/.test(o.nodeValue)) {
          return false
        }
        continue
      }
      if (o.nodeType !== Node.ELEMENT_NODE) {
        return false
      }
      let e = normalizedElementTagName(o)
      if (e === 'figure' || e === 'table') {
        return false
      }
      if (o.classList.contains('auxiliary')) {
        return false
      }
      if (e === 'img') {
        if (i) {
          return false
        }
        i = true
      }
      var l = o.originalElement
      if (
        !(
          a ||
          (l && !hasClassMatchingRegexp(o.originalElement, n)) ||
          !/\S/.test(o.innerText)
        )
      ) {
        a = true
      }
    }
    return i && a
  }
  function cleanStyleAndClassList(e) {
    if (!e.classList.length) {
      e.removeAttribute('class')
    }
    if (!e.getAttribute('style')) {
      e.removeAttribute('style')
    }
  }
  function getVisibleNonWhitespaceTextNodes(el, t, n, r, i) {
    function a(e) {
      var t = e.children[0]
      if (t) {
        for (var n = t.children, r = n.length, i = 0; i < r; ++i) {
          if (getComputedStyle(n[i]).float !== 'none') {
            return false
          }
        }
      }
      return true
    }
    function processNode(node, r) {
      if (processedCount++ >= MAX_NODES) {
        return
      }
      if (node.nodeType === Node.TEXT_NODE) {
        if (/\S/.test(node.nodeValue)) {
          res.push(node)
        }
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return
      }
      if (!isElementVisible(node)) {
        return
      }
      if (n && ++l > n) {
        return
      }
      if (i && i.has(node)) {
        return
      }
      let u = normalizedElementTagName(node)
      if (u !== 'iframe' && u !== 'form') {
        if (c.has(u)) {
          r--
        } else if ((u !== 'ul' && u !== 'ol') || !a(node)) {
          var m = node.parentElement
          if (m) {
            if (
              !(
                normalizedElementTagName(m) !== 'section' ||
                node.previousElementSibling ||
                node.nextElementSibling
              )
            ) {
              r--
            }
          }
        } else {
          r--
        }
        var d = r + 1
        if (d < t) {
          for (var h = node.childNodes, g = h.length, f = 0; f < g; ++f) {
            processNode(h[f], d)
          }
        }
      }
    }
    var processedCount = 0
    var l = 0
    var res = []
    let c = new Set(['p', 'strong', 'b', 'em', 'i', 'span', 'section'])
    if (r) {
      c.add('center')
      c.add('font')
    }
    processNode(el, 0)
    return res
  }
  function mapOfVisibleTextNodeComputedStyleReductionToNumberOfMatchingCharacters(
    root,
    fn,
  ) {
    var n = {}
    const r = getVisibleNonWhitespaceTextNodes(root, 100)
    for (var i = 0; i < r.length; ++i) {
      var o = r[i]
      var l = o.length
      var s = o.parentElement
      var c = fn(getComputedStyle(s))
      if (n[c]) {
        n[c] += l
      } else {
        n[c] = l
      }
    }
    return n
  }
  function keyOfMaximumValueInDictionary(e) {
    var t
    var n
    for (var r in e) {
      var i = e[r]
      if (!n || i > n) {
        t = r
        n = i
      }
    }
    return t
  }
  function elementIsProtected(e) {
    return e.classList.contains('protected') || e.querySelector('.protected')
  }
  function dominantFontFamilyAndSizeForElement(root) {
    return keyOfMaximumValueInDictionary(
      mapOfVisibleTextNodeComputedStyleReductionToNumberOfMatchingCharacters(
        root,
        function (e) {
          return e.fontFamily + '|' + e.fontSize
        },
      ),
    )
  }
  function dominantFontSizeInPointsFromFontFamilyAndSizeString(e) {
    if (e) {
      return parseInt(e.split('|')[1])
    } else {
      return null
    }
  }
  function canvasElementHasNoUserVisibleContent(e) {
    if (!e.width || !e.height) {
      return true
    }
    for (
      var t = e.getContext('2d').getImageData(0, 0, e.width, e.height).data,
      n = 0,
      r = t.length;
      n < r;
      n += 4
    ) {
      if (t[n + 3]) {
        return false
      }
    }
    return true
  }
  function findArticleNodeSelectorsInQuirksListForHostname(e, t) {
    const n = [
      [AppleDotComAndSubdomainsRegex, "*[itemprop='articleBody']"],
      [/^(.+\.)?buzzfeed\.com\.?$/, 'article #buzz_sub_buzz'],
      [/^(.+\.)?mashable\.com\.?$/, '.parsec-body .parsec-container'],
      [/^(.+\.)?cnet\.com\.?$/, '#rbContent.container'],
      [/^(.+\.)?engadget\.com\.?$/, 'main article #page_body'],
      [/^(.*\.)?m\.wikipedia\.org\.?$/, '#content #bodyContent'],
      [/^(.*\.)?theintercept\.com\.?$/, '.PostContent'],
      [/^(.*\.)?tools\.ietf\.org\.?$/, 'div.content'],
      [/^(.+\.)?meteoinfo\.ru\.?$/, '#jm-content-bottom'],
      [/^(.*\.)?tmd\.go\.th\.?$/, '#sidebar'],
    ]
    for (var r = n.length, i = 0; i < r; ++i) {
      var a = n[i]
      if (a[0].test(e.toLowerCase())) {
        if (t(a[1])) {
          return
        }
      }
    }
  }
  function functionToPreventPruningDueToInvisibilityInQuirksListForHostname(e) {
    const t = [
      [
        /^mobile\.nytimes\.com\.?$/,
        function (e, t) {
          var n = e
          if (!t) {
            return false
          }
          for (; n && n !== t;) {
            if (n.classList.contains('hidden')) {
              return true
            }
            n = n.parentElement
          }
          return false
        },
      ],
    ]
    for (var n = t.length, r = 0; r < n; ++r) {
      var i = t[r]
      if (i[0].test(e.toLowerCase())) {
        return i[1]
      }
    }
    return null
  }
  function elementIsAHeader(e) {
    return !!{
      h1: 1,
      h2: 1,
      h3: 1,
      h4: 1,
      h5: 1,
      h6: 1,
    }[normalizedElementTagName(e)]
  }
  function leafElementForElementAndDirection(e, t) {
    var n = e.ownerDocument
    var r = n.createTreeWalker(n.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (e) {
        if (e.children.length === 0) {
          return NodeFilter.FILTER_ACCEPT
        } else {
          return NodeFilter.FILTER_SKIP
        }
      },
    })
    r.currentNode = e
    return r[t]()
  }
  function previousLeafElementForElement(e) {
    return leafElementForElementAndDirection(e, 'previousNode')
  }
  function nextLeafElementForElement(e) {
    return leafElementForElementAndDirection(e, 'nextNode')
  }
  function nextNonFloatingVisibleElementSibling(e) {
    for (var t = e; (t = t.nextElementSibling);) {
      if (isElementVisible(t) && getComputedStyle(t).float === 'none') {
        return t
      }
    }
    return null
  }
  function elementWithLargestAreaFromElements(e) {
    var t
    var n = e.length
    if (!n) {
      return null
    }
    for (var r = 0, i = 0; i < n; ++i) {
      var a = e[i]
      var o = cachedElementBoundingRect(a)
      var l = o.width * o.height
      if (l > r) {
        t = a
        r = l
      }
    }
    return t
  }
  function unwrappedArticleContentElement(e) {
    for (var t = e; ;) {
      for (var n = t.childNodes, r = n.length, i = null, a = 0; a < r; ++a) {
        var o = n[a]
        var l = o.nodeType
        if (
          l === Node.ELEMENT_NODE ||
          (l === Node.TEXT_NODE && !isNodeWhitespace(o))
        ) {
          if (i) {
            return t
          }
          var s = normalizedElementTagName(o)
          if (s !== 'div' && s !== 'article' && s !== 'section') {
            return t
          }
          i = o
        }
      }
      if (!i) {
        break
      }
      t = i
    }
    return t
  }
  function elementsMatchingClassesInClassList(e, t) {
    return elementsOfSameClassIgnoringClassNamesMatchingRegexp(e, t)
  }
  function elementsMatchingClassesInClassListIgnoringCommonLayoutClassNames(
    e,
    t,
  ) {
    return elementsOfSameClassIgnoringClassNamesMatchingRegexp(e, t, /clearfix/i)
  }
  function elementsMatchingClassesInClassListIgnoringClassesWithNumericSuffix(
    e,
    t,
  ) {
    return elementsOfSameClassIgnoringClassNamesMatchingRegexp(e, t, /\d+$/)
  }
  function elementsOfSameClassIgnoringClassNamesMatchingRegexp(e, t, n) {
    for (var r = '', i = e.length, a = 0; a < i; ++a) {
      var o = e[a]
      if (!(n && n.test(o))) {
        r += '.' + o
      }
    }
    try {
      return t.querySelectorAll(r)
    } catch (e) {
      return []
    }
  }
  function imageIsContainedByContainerWithImageAsBackgroundImage(e) {
    var t = e.parentElement
    if (!t || !t.style || !t.style.backgroundImage) {
      return false
    }
    var n = /url\((.*)\)/.exec(t.style.backgroundImage)
    return !(!n || n.length !== 2) && n[1] === e.src
  }
  function pseudoElementContent(e, t) {
    var n = getComputedStyle(e, t).content
    var r = /^\"(.*)\"$/.exec(n)
    if (r && r.length == 2) {
      return r[1]
    } else {
      return n
    }
  }
  function hasClassMatchingRegexp(e, t) {
    for (var n = e.classList, r = n.length, i = 0; i < r; ++i) {
      if (t.test(n[i])) {
        return true
      }
    }
    return false
  }
  function elementLooksLikeDropCap(e) {
    return hasClassMatchingRegexp(e, DropCapRegex) && e.innerText.length === 1
  }
  function changeElementType(e, t) {
    for (
      var n = e.ownerDocument.createElement(t),
      r = attributesForElement(e),
      i = r.length,
      a = 0;
      a < i;
      ++a
    ) {
      var o = r.item(a)
      n.setAttribute(o.nodeName, o.nodeValue)
    }
    for (; e.firstChild;) {
      n.appendChild(e.firstChild)
    }
    e.replaceWith(n)
    return n
  }
  function pathComponentsForAnchor(e) {
    var t = e.pathname.substring(1).split('/')
    if (!t[t.length - 1]) {
      t.pop()
    }
    return t
  }
  function lastPathComponentFromAnchor(e) {
    var t = pathComponentsForAnchor(e)
    if (t.length) {
      return t[t.length - 1]
    } else {
      return null
    }
  }
  function clamp(e, t, n) {
    return Math.min(Math.max(e, t), n)
  }
  function normalizedElementTagName(e) {
    return e.localName
  }
  function childrenWithParallelStructure(e) {
    var t = e.children
    if (!t) {
      return []
    }
    var n = t.length
    if (!n) {
      return []
    }
    for (var r = {}, i = 0; i < n; ++i) {
      var a = t[i]
      if (
        !SetOfCandidateTagNamesToIgnore.has(normalizedElementTagName(a)) &&
        a.className
      ) {
        for (var o = a.classList, l = o.length, s = 0; s < l; ++s) {
          if ((m = r[(u = o[s])])) {
            m.push(a)
          } else {
            r[u] = [a]
          }
        }
      }
    }
    var c = Math.floor(n / 2)
    for (var u in r) {
      var m
      if ((m = r[u]).length > c) {
        return m
      }
    }
    return []
  }
  function elementAppearsToBeCollapsed(e) {
    return (
      !(
        !ReaderArticleFinderJS.isMediaWikiPage() || !/collaps/.test(e.className)
      ) ||
      (e.getAttribute('aria-expanded') === 'false' && !isElementVisible(e))
    )
  }
  const ReaderMinimumScore = 1600
  const ReaderMinimumAdvantage = 15
  const ArticleMinimumScoreDensity = 4.25
  const CandidateMinimumWidthPortionForIndicatorElements = 0.5
  const CandidateMinumumListItemLineCount = 4
  const SetOfCandidateTagNamesToIgnore = new Set([
    'a',
    'embed',
    'form',
    'html',
    'iframe',
    'object',
    'ol',
    'option',
    'script',
    'style',
    'svg',
    'ul',
  ])
  const PrependedArticleCandidateMinimumHeight = 50
  const AppendedArticleCandidateMinimumHeight = 200
  const AppendedArticleCandidateMaximumVerticalDistanceFromArticle = 150
  const StylisticClassNames = {
    justfy: 1,
    justify: 1,
    left: 1,
    right: 1,
    small: 1,
  }
  const CommentRegEx = /[Cc]omment|meta|footer|footnote|talkback/
  const CommentMatchPenalty = 0.75
  const ArticleRegEx =
    /(?:(?:^|\s)(?:(post|hentry|entry)[-_]{0,2}(?:content|text|body)?|article[-_]{0,2}(?:content|text|body|page|copy)?)(?:\s|$))/i
  const ArticleMatchBonus = 0.5
  const CarouselRegEx = /carousel/i
  const CarouselMatchPenalty = 0.75
  const SectionRegex = /section|content.*component/i
  const DropCapRegex = /first.*letter|drop.*cap/i
  const ProgressiveLoadingRegex = /progressive/i
  const DensityExcludedElementSelector =
    '#disqus_thread, #comments, .userComments'
  const PositiveRegEx =
    /article|body|content|entry|hentry|page|pagination|post|related-asset|text/i
  const NegativeRegEx =
    /advertisement|breadcrumb|combx|comment|contact|disqus|footer|link|meta|mod-conversations|promo|related|scroll|share|shoutbox|sidebar|social|sponsor|spotim|subscribe|talkback|tags|toolbox|widget|[-_]ad$|zoom-(in|out)/i
  const VeryPositiveClassNameRegEx = /instapaper_body/
  const VeryNegativeClassNameRegEx = /instapaper_ignore/
  const SharingRegex =
    /email|print|rss|digg|slashdot|delicious|reddit|share|twitter|facebook|pinterest|whatsapp/i
  const VeryLiberalCommentRegex = /comment/i
  const AdvertisementHostRegex = /^adserver\.|doubleclick.net$/i
  const SidebarRegex = /sidebar/i
  const MinimumAverageDistanceBetweenHRElements = 400
  const MinimumAverageDistanceBetweenHeaderElements = 400
  const PortionOfCandidateHeightToIgnoreForHeaderCheck = 0.1
  const DefaultNumberOfTextNodesToCheckForLanguageMultiplier = 3
  const NumberOfCharactersPerTextNodeToEvaluateForLanguageMultiplier = 12
  const MinimumRatioOfCharactersForLanguageMultiplier = 0.5
  const ScoreMultiplierForChineseJapaneseKorean = 3
  const MinimumContentMediaHeight = 150
  const MinimumContentMediaWidthToArticleWidthRatio = 0.25
  const MaximumContentMediaAreaToArticleAreaRatio = 0.2
  const LinkContinueMatchRegEx = /continue/gi
  const LinkNextMatchRegEx = /next/gi
  const LinkPageMatchRegEx = /page/gi
  const LinkListItemBonus = 5
  const LinkPageMatchBonus = 10
  const LinkNextMatchBonus = 15
  const LinkContinueMatchBonus = 15
  const LinkNextOrdinalValueBase = 3
  const LinkMismatchValueBase = 2
  const LinkMatchWeight = 200
  const LinkMaxVerticalDistanceFromArticle = 200
  const LinkVerticalDistanceFromArticleWeight = 150
  const LinkCandidateXPathQuery =
    "descendant-or-self::*[(not(@id) or (@id!='disqus_thread' and @id!='comments')) and (not(@class) or @class!='userComments')]/a"
  const LinkDateRegex =
    /\D(?:\d\d(?:\d\d)?[\-\/](?:10|11|12|0?[1-9])[\-\/](?:30|31|[12][0-9]|0?[1-9])|\d\d(?:\d\d)?\/(?:10|11|12|0[1-9])|(?:10|11|12|0?[1-9])\-(?:30|31|[12][0-9]|0?[1-9])\-\d\d(?:\d\d)?|(?:30|31|[12][0-9]|0?[1-9])\-(?:10|11|12|0?[1-9])\-\d\d(?:\d\d)?)\D/
  const LinkURLSearchParameterKeyMatchRegex = /(page|^p$|^pg$)/i
  const LinkURLPageSlashNumberMatchRegex = /\/.*page.*\/\d+/i
  const LinkURLSlashDigitEndMatchRegex = /\/\d+\/?$/
  const LinkURLArchiveSlashDigitEndMatchRegex = /archives?\/\d+\/?$/
  const LinkURLBadSearchParameterKeyMatchRegex =
    /author|comment|feed|id|nonce|related/i
  const LinkURLSemanticMatchBonus = 100
  const LinkMinimumURLSimilarityRatio = 0.75
  const SubheadRegex = /sub(head|title)|description|dec?k|abstract/i
  const HeaderMinimumDistanceFromArticleTop = 200
  const HeaderLevenshteinDistanceToLengthRatio = 0.75
  const MinimumRatioOfListItemsBeingRelatedToSharingToPruneEntireList = 0.5
  const FloatMinimumHeight = 130
  const ImageSizeTiny = 32
  const ToleranceForLeadingMediaWidthToArticleWidthForFullWidthPresentation = 80
  const MaximumFloatWidth = 325
  const AnchorImageMinimumWidth = 100
  const AnchorImageMinimumHeight = 100
  const MinimumHeightForImagesAboveTheArticleTitle = 50
  const MainImageMinimumWidthAndHeight = 83
  const BaseFontSize = 16
  const BaseLineHeightRatio = 1.125
  const MaximumExactIntegralValue = 9007199254740992
  const TitleCandidateDepthScoreMultiplier = 0.1
  const TextNodeLengthPower = 1.25
  const LazyLoadRegex = /lazy/i
  const HeaderElementsSelector = 'h1, h2, h3, h4, h5, h6'
  const StringSimilarityToDeclareStringsNearlyIdentical = 0.97
  const FindArticleMode = {
    Element: false,
    ExistenceOfElement: true,
  }
  const AppleDotComAndSubdomainsRegex = /.*\.apple\.com\.?$/
  const SchemaDotOrgArticleContainerSelector =
    "*[itemtype='https://schema.org/Article'], *[itemtype='https://schema.org/NewsArticle'], *[itemtype='https://schema.org/APIReference'], *[itemtype='http://schema.org/Article'], *[itemtype='http://schema.org/NewsArticle'], *[itemtype='http://schema.org/APIReference']"
  const MaximumWidthOrHeightOfImageInMetadataSection = 20
  var attributesForElement = (function () {
    var e = Element.prototype.__lookupGetter__('attributes')
    return function (t) {
      return e.call(t)
    }
  })()
  const TweetURLRegex =
    /^https?:\/\/(.+\.)?twitter\.com\/.*\/status\/(.*\/)*[0-9]+\/?$/i
  const TweetIframeTitleRegex = /tweet/i
  const EmbeddedTwitterIframeSrcRegEx =
    /^https?:\/\/platform\.twitter\.com\/embed\/Tweet\.html/i
  CandidateElement = function (e, t) {
    this.element = e
    this.contentDocument = t
    this.textNodes = this.usableTextNodesInElement(this.element)
    this.rawScore = this.calculateRawScore()
    this.tagNameAndAttributesScoreMultiplier =
      this.calculateElementTagNameAndAttributesScoreMultiplier()
    this.languageScoreMultiplier = 0
    this.depthInDocument = 0
  }
  CandidateElement.extraArticleCandidateIfElementIsViable = function (
    e,
    t,
    n,
    r,
  ) {
    const i = 'a, b, strong, i, em, u, span'
    var a = cachedElementBoundingRect(e)
    var o = cachedElementBoundingRect(t.element)
    if (
      ((r && a.height < PrependedArticleCandidateMinimumHeight) ||
        (!r && a.height < AppendedArticleCandidateMinimumHeight)) &&
      e.childElementCount &&
      e.querySelectorAll('*').length !== e.querySelectorAll(i).length
    ) {
      return null
    }
    if (r) {
      if (a.bottom > o.top) {
        return null
      }
    } else if (a.top < o.bottom) {
      return null
    }
    if (
      !r &&
      a.top - o.bottom >
      AppendedArticleCandidateMaximumVerticalDistanceFromArticle
    ) {
      return null
    }
    if (a.left > o.right || a.right < o.left) {
      return null
    }
    if (elementLooksLikePartOfACarousel(e)) {
      return null
    }
    var l = new CandidateElement(e, n)
    l.isPrepended = r
    return l
  }
  CandidateElement.candidateIfElementIsViable = function (e, t, n) {
    var r = cachedElementBoundingRect(e)
    var i = ReaderArticleFinderJS.candidateElementFilter
    if (
      r.width < i.minimumWidth ||
      r.height < i.minimumHeight ||
      r.width * r.height < i.minimumArea ||
      (!n && r.top > i.maximumTop) ||
      CandidateElement.candidateElementAdjustedHeight(e) < i.minimumHeight
    ) {
      return null
    } else {
      return new CandidateElement(e, t)
    }
  }
  CandidateElement.candidateElementAdjustedHeight = function (e) {
    for (
      var t = cachedElementBoundingRect(e),
      n = t.height,
      r = e.getElementsByTagName('form'),
      i = r.length,
      a = 0;
      a < i;
      ++a
    ) {
      var o = cachedElementBoundingRect(r[a])
      if (o.width > t.width * CandidateMinimumWidthPortionForIndicatorElements) {
        n -= o.height
      }
    }
    var l = e.querySelectorAll('ol, ul')
    var s = l.length
    var c = null
    for (a = 0; a < s; ++a) {
      var u = l[a]
      if (
        !(c && c.compareDocumentPosition(u) & Node.DOCUMENT_POSITION_CONTAINED_BY)
      ) {
        var m = u.getElementsByTagName('li')
        var d = m.length
        var h = cachedElementBoundingRect(u)
        if (d) {
          var g = h.height / d
          var f = getComputedStyle(m[0])
          var p = parseInt(f.lineHeight)
          if (isNaN(p)) {
            p = fontSizeFromComputedStyle(f) * BaseLineHeightRatio
          }
          if (
            h.width >
            t.width * CandidateMinimumWidthPortionForIndicatorElements &&
            g / p < CandidateMinumumListItemLineCount
          ) {
            n -= h.height
            c = u
          }
        } else {
          n -= h.height
        }
      }
    }
    return n
  }
  CandidateElement.prototype = {
    calculateRawScore: function () {
      for (var e = 0, t = this.textNodes, n = t.length, r = 0; r < n; ++r) {
        e += this.rawScoreForTextNode(t[r])
      }
      return e
    },
    calculateElementTagNameAndAttributesScoreMultiplier: function () {
      return scoreMultiplierForElementTagNameAndAttributes(this.element)
    },
    calculateLanguageScoreMultiplier: function () {
      if (this.languageScoreMultiplier === 0) {
        this.languageScoreMultiplier = languageScoreMultiplierForTextNodes(
          this.textNodes,
        )
      }
    },
    depth: function () {
      if (!this.depthInDocument) {
        this.depthInDocument = elementDepth(this.element)
      }
      return this.depthInDocument
    },
    finalScore: function () {
      this.calculateLanguageScoreMultiplier()
      return this.basicScore() * this.languageScoreMultiplier
    },
    basicScore: function () {
      return this.rawScore * this.tagNameAndAttributesScoreMultiplier
    },
    scoreDensity: function () {
      var e = 0
      var t = this.element.querySelector(DensityExcludedElementSelector)
      if (t) {
        e = t.clientWidth * t.clientHeight
      }
      for (var n = this.element.children || [], r = n.length, i = 0; i < r; ++i) {
        var a = n[i]
        if (elementIsCommentBlock(a)) {
          e += a.clientWidth * a.clientHeight
        }
      }
      var o =
        cachedElementBoundingRect(this.element).width *
        cachedElementBoundingRect(this.element).height
      var l = o * MaximumContentMediaAreaToArticleAreaRatio
      var s =
        cachedElementBoundingRect(this.element).width *
        MinimumContentMediaWidthToArticleWidthRatio
      var c = this.element.querySelectorAll('img, video')
      var u = c.length
      for (i = 0; i < u; ++i) {
        var m = cachedElementBoundingRect(c[i])
        if (m.width >= s && m.height > MinimumContentMediaHeight) {
          var d = m.width * m.height
          if (d < l) {
            e += d
          }
        }
      }
      var h = this.basicScore()
      var g = o - e
      var f = this.textNodes.length
      var p = 0
      var E = 0
      for (i = 0; i < f; ++i) {
        var v = this.textNodes[i].parentNode
        if (v) {
          E += fontSizeFromComputedStyle(getComputedStyle(v))
          p++
        }
      }
      var N = BaseFontSize
      if (p) {
        N = E /= p
      }
      this.calculateLanguageScoreMultiplier()
      return (h / g) * 1000 * (N / BaseFontSize) * this.languageScoreMultiplier
    },
    usableTextNodesInElement: function (e) {
      var t = []
      if (!e) {
        return t
      }
      const n = new Set([
        'a',
        'dd',
        'dt',
        'noscript',
        'ol',
        'option',
        'pre',
        'script',
        'style',
        'td',
        'ul',
        'iframe',
      ])
      var r = this.contentDocument
      function i(e) {
        const i =
          'text()|*/text()|*/a/text()|*/li/text()|*/li/p/text()|*/span/text()|*/em/text()|*/i/text()|*/strong/text()|*/b/text()|*/font/text()|blockquote/*/text()|div[count(./p)=count(./*)]/p/text()|div[count(*)=1]/div/p/text()|div[count(*)=1]/div/p/*/text()|div/div/text()'
        for (
          var a = r.evaluate(
            i,
            e,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null,
          ),
          o = a.snapshotLength,
          l = 0;
          l < o;
          ++l
        ) {
          var s = a.snapshotItem(l)
          if (
            !(
              n.has(normalizedElementTagName(s.parentNode)) ||
              s._countedTextNode ||
              isNodeWhitespace(s)
            )
          ) {
            s._countedTextNode = true
            t.push(s)
          }
        }
      }
      i(e)
      for (
        var a = childrenWithParallelStructure(e), o = a.length, l = 0;
        l < o;
        ++l
      ) {
        i(a[l])
      }
      var s = t.length
      for (l = 0; l < s; ++l) {
        delete t[l]._countedTextNode
      }
      return t
    },
    addTextNodesFromCandidateElement: function (e) {
      for (var t = this.textNodes.length, n = 0; n < t; ++n) {
        this.textNodes[n].alreadyCounted = true
      }
      var r = e.textNodes
      var i = r.length
      for (n = 0; n < i; ++n) {
        if (!r[n].alreadyCounted) {
          this.textNodes.push(r[n])
        }
      }
      t = this.textNodes.length
      n = 0
      for (; n < t; ++n) {
        this.textNodes[n].alreadyCounted = null
      }
      this.rawScore = this.calculateRawScore()
    },
    rawScoreForTextNode: function (e) {
      const t = 20
      if (!e) {
        return 0
      }
      var n = e.length
      if (n < t) {
        return 0
      }
      var r = e.parentNode
      if (!isElementVisible(r)) {
        return 0
      }
      for (var i = 1; r && r !== this.element;) {
        i -= 0.1
        r = r.parentNode
      }
      return Math.pow(n * i, TextNodeLengthPower)
    },
    shouldDisqualifyDueToScoreDensity: function () {
      return this.scoreDensity() < ArticleMinimumScoreDensity
    },
    shouldDisqualifyDueToHorizontalRuleDensity: function () {
      for (
        var e = this.element.getElementsByTagName('hr'),
        t = e.length,
        n = 0,
        r = cachedElementBoundingRect(this.element),
        i = r.width * 0.7,
        a = 0;
        a < t;
        ++a
      ) {
        if (e[a].clientWidth > i) {
          n++
        }
      }
      if (n && r.height / n < MinimumAverageDistanceBetweenHRElements) {
        return true
      }
      return false
    },
    shouldDisqualifyDueToHeaderDensity: function () {
      var e = '(h1|h2|h3|h4|h5|h6|*/h1|*/h2|*/h3|*/h4|*/h5|*/h6)[a[@href]]'
      var t = this.contentDocument.evaluate(
        e,
        this.element,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      )
      var n = t.snapshotLength
      if (n > 2) {
        for (
          var r = 0,
          i = cachedElementBoundingRect(this.element),
          a = i.height * PortionOfCandidateHeightToIgnoreForHeaderCheck,
          o = 0;
          o < n;
          ++o
        ) {
          var l = t.snapshotItem(o)
          if (
            l.querySelector('a[href]').getAttribute('href').substring(0, 1) !==
            '#'
          ) {
            var s = cachedElementBoundingRect(l)
            if (s.top - i.top > a && i.bottom - s.bottom > a) {
              r++
            }
          }
        }
        if (i.height / r < MinimumAverageDistanceBetweenHeaderElements) {
          return true
        }
      }
      return false
    },
    shouldDisqualifyDueToSimilarElements: function (e) {
      function t(e, t) {
        if (!e || !t) {
          return false
        }
        var n = 1
        if (e.className) {
          return e.className === t.className
        } else {
          return (
            elementFingerprintForDepth(e, n) === elementFingerprintForDepth(t, n)
          )
        }
      }
      var n = function (e) {
        const t = /related-posts/i
        for (
          var n = e.parentElement;
          n && n !== this.contentDocument.body;
          n = n.parentElement
        ) {
          if (t.test(n.className)) {
            return true
          }
        }
        return false
      }.bind(this)
      var r = this.element
      if (normalizedElementTagName(r.parentElement) === 'article') {
        return false
      }
      let i = normalizedElementTagName(r)
      if (i === 'li' || i === 'dd') {
        for (var a = r.parentNode, o = a.children.length, l = 0; l < o; ++l) {
          if (
            normalizedElementTagName((f = a.children[l])) === i &&
            f.className === r.className &&
            f !== r
          ) {
            return true
          }
        }
      }
      var s = r.classList
      if (!s.length) {
        if ((r = r.parentElement)) {
          if (!(s = r.classList).length) {
            if ((r = r.parentElement)) {
              s = r.classList
            }
          }
        }
      }
      if (s.length) {
        if (!e) {
          e = []
        }
        var c = e.length
        for (l = 0; l < c; ++l) {
          e[l].element.candidateElement = e[l]
        }
        var u = elementsMatchingClassesInClassListIgnoringCommonLayoutClassNames(
          s,
          this.contentDocument,
        )
        var m = false
        var d = elementDepth(r)
        var h = n(r)
        var g = u.length
        for (l = 0; l < g; ++l) {
          var f
          if (
            (f = u[l]) !== r &&
            f.parentElement !== r &&
            r.parentElement !== f &&
            isElementVisible(f)
          ) {
            var p = f.candidateElement
            if (
              (p || (p = new CandidateElement(f, this.contentDocument))) &&
              p.basicScore() * ReaderMinimumAdvantage > this.basicScore()
            ) {
              if (f.closest('section') && r.closest('section')) {
                return false
              }
              if (
                SectionRegex.test(f.className) &&
                SectionRegex.test(r.className)
              ) {
                return false
              }
              if (n(f) && !h) {
                return false
              }
              if (
                !m &&
                cachedElementBoundingRect(f).bottom <
                cachedElementBoundingRect(this.element).top
              ) {
                m = true
                continue
              }
              if (
                t(r.previousElementSibling, f.previousElementSibling) ||
                t(r.nextElementSibling, f.nextElementSibling)
              ) {
                var E = r.querySelector(HeaderElementsSelector)
                var v = f.querySelector(HeaderElementsSelector)
                if (E && v && elementsHaveSameTagAndClassNames(E, v)) {
                  return true
                }
                E = r.previousElementSibling
                v = f.previousElementSibling
                if (
                  E &&
                  v &&
                  elementIsAHeader(E) &&
                  elementIsAHeader(v) &&
                  elementsHaveSameTagAndClassNames(E, v)
                ) {
                  return true
                }
              }
              if (elementDepth(f) === d) {
                for (
                  ;
                  f.parentElement &&
                  r.parentElement &&
                  f.parentElement !== r.parentElement;

                ) {
                  f = f.parentElement
                  r = r.parentElement
                }
              }
              for (; r.childElementCount <= 1;) {
                if (!r.childElementCount || !f.childElementCount) {
                  return false
                }
                if (f.childElementCount > 1) {
                  return false
                }
                if (
                  normalizedElementTagName(r.firstElementChild) !==
                  normalizedElementTagName(f.firstElementChild)
                ) {
                  return false
                }
                r = r.firstElementChild
                f = f.firstElementChild
              }
              if (f.childElementCount <= 1) {
                return false
              }
              v = f.firstElementChild
              var N = f.lastElementChild
              E = r.firstElementChild
              var A = r.lastElementChild
              if (normalizedElementTagName(v) !== normalizedElementTagName(E)) {
                return false
              }
              if (normalizedElementTagName(N) !== normalizedElementTagName(A)) {
                return false
              }
              var S = v.className
              var C = N.className
              var b = E.className
              var T = N.className
              var y = T === b ? 2 : 1
              if (S.length || b.length) {
                if (!S.length || !b.length) {
                  return false
                }
                if (
                  S === b &&
                  elementsMatchingClassesInClassList(E.classList, r).length <= y
                ) {
                  return true
                }
              }
              if (C.length || T.length) {
                if (!C.length || !T.length) {
                  return false
                }
                if (
                  C === T &&
                  elementsMatchingClassesInClassList(N.classList, r).length <= y
                ) {
                  return true
                }
              }
              var x = E.clientHeight
              var R = A.clientHeight
              return (
                !(!x || !v.clientHeight) &&
                !(!R || !N.clientHeight) &&
                (x === v.clientHeight || R === N.clientHeight)
              )
            }
          }
        }
        for (l = 0; l < c; ++l) {
          e[l].element.candidateElement = null
        }
      }
      return false
    },
    shouldDisqualifyForDeepLinking: function () {
      const e = 5
      for (
        var t = this.element,
        n = this.contentDocument.location,
        r = pathComponentsForAnchor(n).length,
        i = [],
        a = t.getElementsByTagName('a'),
        o = a.length,
        l = 0;
        l < o;
        l++
      ) {
        var s = a[l]
        if (
          n.host === s.host &&
          !(
            pathComponentsForAnchor(s).length <= r ||
            (s.host + s.pathname).indexOf(n.host + n.pathname) !== 0 ||
            anchorLinksToAttachment(s) ||
            (i.push(s), i.length < e)
          )
        ) {
          var c = t.offsetTop + t.offsetHeight / e
          return i[0].offsetTop < c
        }
      }
      return false
    },
  }
  String.prototype.lastInteger = function () {
    const e = /[0-9]+/g
    var t = this.match(e)
    if (t) {
      return parseInt(t[t.length - 1])
    } else {
      return NaN
    }
  }
  class ReaderArticleFinder {
    constructor(contentDocument) {
      console.log('init reader article finder, document', contentDocument)
      if (!contentDocument) {
        throw new Error('ReaderArticleFinder: contentDocument may not be nil')
      }
      this.contentDocument = contentDocument
      this.didSearchForArticleNode = false
      this.didChangeContentDocumentToFrameOnPage = false
      this.article = null
      this.didSearchForExtraArticleNode = false
      this.extraArticle = null
      this._leadingMediaElement = null
      this._isMediaWikiPage = undefined
      this._cachedScrollY = 0
      this._cachedScrollX = 0
      this._elementsWithCachedBoundingRects = []
      this._cachedContentTextStyle = null
      this.pageNumber = 1
      this.prefixWithDateForNextPageURL = null
      this.previouslyDiscoveredPageURLStrings = []
      this.candidateElementFilter = {
        minimumWidth: 280,
        minimumHeight: 295,
        minimumArea: 170000,
        maxTop: 1300,
      }
      let t = 0
      this._nextUniqueID = function () {
        return t++ + ''
      }
      this._mapOfUniqueIDToOriginalElement = new Map()
      this._weakMapOfOriginalElementToUniqueID = new WeakMap()
    }
    setCandidateElementFilter(e) {
      let [t, n] = this._validityAndValidCandidateElementFilterFromFilter(e)
      if (t) {
        this.candidateElementFilter = n
      }
    }
    _validityAndValidCandidateElementFilterFromFilter(e) {
      let t = {}
      let n = false
      for (let i of ['minimumWidth', 'minimumHeight', 'minimumArea', 'maxTop']) {
        let r = (e || {})[i]
        if (r === undefined || typeof r != 'number' || r < 0) {
          t = {}
          n = false
          break
        }
        t[i] = r
        n = true
      }
      return [n, t]
    }
    pointsForDominantIframeHitTest() {
      const e = 60
      return [
        [e, e],
        [window.innerWidth - e, e],
        [e, window.innerHeight - e],
        [window.innerWidth - e, window.innerHeight - e],
      ]
    }
    dominantContentIframe() {
      let e
      let t = this.pointsForDominantIframeHitTest()
      let n = t.length
      for (let i = 0; i < n; i++) {
        let cornerElement = document.elementFromPoint(t[i][0], t[i][1])
        if (!cornerElement || cornerElement.tagName !== 'IFRAME') {
          return null
        }
        if (e) {
          if (e !== cornerElement) {
            return null
          }
        } else {
          e = cornerElement
        }
      }
      return e
    }
    checkForIframeCoveringMostOfWebpage() {
      let e = this.dominantContentIframe()
      if (e && !this.didChangeContentDocumentToFrameOnPage) {
        this.contentDocument = e.contentDocument
        this.resetArticleInformation()
        this.didChangeContentDocumentToFrameOnPage = true
      }
    }
    isReaderModeAvailable() {
      this.checkForIframeCoveringMostOfWebpage()
      return (
        !!this.findArticleBySearchingQuirksList() ||
        (this.cacheWindowScrollPosition(),
          !!this.findArticleFromMetadata(FindArticleMode.ExistenceOfElement) ||
          ((this.article = this.findArticleByVisualExamination()),
            this.article && this.articleIsLTR(),
            !!this.article))
      )
    }
    resetArticleInformation() {
      this.didSearchForArticleNode = false
      this.didSearchForExtraArticleNode = false
      delete this.article
      delete this.extraArticle
      delete this._articleTitleInformation
      delete this._articleTitleElement
      delete this._leadingMediaElement
      delete this._cachedContentTextStyle
      delete this._adoptableArticle
      delete this._articleIsLTR
      delete this._nextPageURL
      delete this._cachedScrollY
      delete this._cachedScrollX
      clearCachedElementBoundingRects()
    }
    reset() {
      this.resetArticleInformation()
      this.prepareToTransitionToReader()
    }
    prepareToTransitionToReader() {
      this.adoptableArticle(true)
      this.nextPageURL()
      this.articleIsLTR()
    }
    nextPageURL() {
      if (!this._nextPageURL) {
        var e = this.nextPageURLString()
        if (typeof ReaderArticleFinderJSController != 'undefined' && e) {
          e = ReaderArticleFinderJSController.substituteURLForNextPageURL(e)
        }
        this._nextPageURL = e
      }
      return this._nextPageURL
    }
    containerElementsForMultiPageContent() {
      const e = /(.*page[^0-9]*|.*article.*item[^0-9]*)(\d{1,2})(.*)/i
      const t = 3
      for (
        var n, i = [], r = this.articleNode(), a = 0;
        !(n = e.exec(r.getAttribute('id')));

      ) {
        if (!(r = r.parentElement) || a++ === t) {
          return []
        }
      }
      for (var l = childrenOfParentElement(r), o = l.length, s = 0; s < o; ++s) {
        var c = l[s]
        if (c !== r) {
          var m = e.exec(c.getAttribute('id'))
          if (m && m[1] === n[1] && m[3] === n[3]) {
            if (!(isElementVisible(c) && !isElementPositionedOffScreen(c))) {
              i.push(c)
            }
          }
        }
      }
      return i
    }
    adoptableMultiPageContentElements() {
      return this.containerElementsForMultiPageContent().map(function (e) {
        return this.cleanArticleNode(e, e.cloneNode(true), 0, false)
      }, this)
    }
    classNameIsSignificantInRouteComputation(e) {
      return !!e && !(e.toLowerCase() in StylisticClassNames)
    }
    shouldIgnoreInRouteComputation(e) {
      let t = normalizedElementTagName(e)
      return (
        t === 'script' ||
        t === 'link' ||
        t === 'style' ||
        (t === 'tr' && !e.offsetHeight)
      )
    }
    routeToArticleNode() {
      for (var e = [], t = this.articleNode(); t;) {
        var n = {}
        n.tagName = normalizedElementTagName(t)
        var i = t.getAttribute('id')
        if (i) {
          n.id = i
        }
        if (this.classNameIsSignificantInRouteComputation(t.className)) {
          n.className = t.className
        }
        n.index = 1
        for (var r = t.previousElementSibling; r; r = r.previousElementSibling) {
          if (!this.shouldIgnoreInRouteComputation(r)) {
            n.index++
          }
        }
        e.unshift(n)
        t = t.parentElement
      }
      return e
    }
    adjustArticleNodeUpwardIfNecessary() {
      if (!this.article) {
        return
      }
      var e = this.article.element
      if (!e.parentElement) {
        return
      }
      for (var t = e; t; t = t.parentElement) {
        if (VeryPositiveClassNameRegEx.test(t.className)) {
          this.article.element = t
          return
        }
      }
      if (
        normalizedElementTagName(e) === 'header' &&
        normalizedElementTagName(e.parentElement) === 'article'
      ) {
        this.article.element = e.parentElement
        return
      }
      var n = e.previousElementSibling
      if (
        n &&
        normalizedElementTagName(n) === 'figure' &&
        normalizedElementTagName(e.parentElement) === 'article'
      ) {
        this.article.element = e.parentElement
        return
      }
      var i =
        normalizedElementTagName(e) === 'section'
          ? e
          : nearestAncestorElementWithTagName(e, 'section', ['article'])
      if (i) {
        var r = i.parentElement
        var a = (function () {
          for (var e = r.children, t = e.length, n = 0; n < t; ++n) {
            var a = e[n]
            var l = normalizedElementTagName(a)
            if (a !== i && (l === 'section' || l === 'header')) {
              return true
            }
          }
          return false
        })()
        if (
          a &&
          (/\barticleBody\b/.test(r.getAttribute('itemprop')) ||
            normalizedElementTagName(r) === 'main' ||
            r.getAttribute('role') === 'main' ||
            normalizedElementTagName(r) === 'article' ||
            r === this.contentDocument.body ||
            r.classList.contains('entry-content'))
        ) {
          this.article.element = r
          return
        }
      }
      const l = /intro/i
      const o = /body|content/i
      e = this.article.element
      if (
        (l.test(e.className) &&
          e.nextElementSibling &&
          o.test(e.nextElementSibling.className)) ||
        (o.test(e.className) &&
          e.previousElementSibling &&
          l.test(e.previousElementSibling.className))
      ) {
        this.article.element = e.parentElement
        return
      }
      if (normalizedElementTagName(e) !== 'article') {
        var s = e.parentElement.closest("*[itemprop='articleBody']")
        if (s && s.parentElement.closest(SchemaDotOrgArticleContainerSelector)) {
          this.article.element = s
          return
        }
      }
      var c = e.closest('article')
      if (c) {
        e = unwrappedArticleContentElement(e)
        var m
        var d = elementDepth(e)
        if (!(normalizedElementTagName(e) !== 'p' || e.className)) {
          e = e.parentElement
          d--
        }
        if (e.classList.length) {
          if (
            (m = elementsMatchingClassesInClassListIgnoringCommonLayoutClassNames(
              e.classList,
              this.contentDocument,
            )).length === 1
          ) {
            m =
              elementsMatchingClassesInClassListIgnoringClassesWithNumericSuffix(
                e.classList,
                this.contentDocument,
              )
          }
        } else {
          m = e.parentElement.children
        }
        for (var h = m.length, u = 0; u < h; ++u) {
          var f = m[u]
          if (
            e !== f &&
            d === elementDepth(f) &&
            isElementVisible(f) &&
            !f.querySelector('article') &&
            Object.keys(e.dataset).join() === Object.keys(f.dataset).join() &&
            dominantFontFamilyAndSizeForElement(e) ===
            dominantFontFamilyAndSizeForElement(f)
          ) {
            this.article.element = c
            return
          }
        }
      }
      let g = this.findExtraArticle()
      let p = g ? g.element : null
      if (
        p &&
        p.parentElement &&
        e.parentElement === p.parentElement &&
        ArticleRegEx.test(e.parentElement.className)
      ) {
        if (
          dominantFontFamilyAndSizeForElement(e) ===
          dominantFontFamilyAndSizeForElement(p)
        ) {
          this.article.element = e.parentElement
          return
        }
      }
      let E = e.parentElement
      if (
        elementIsCommentBlock(e) &&
        !elementIsCommentBlock(E) &&
        ArticleRegEx.test(E.className)
      ) {
        let e = CandidateElement.candidateIfElementIsViable(
          E,
          this.contentDocument,
          true,
        )
        if (e && e.finalScore() >= ReaderMinimumScore) {
          this.article.element = E
          return
        }
      }
      if (!(e = this.article.element).getAttribute('id') && e.className) {
        var v = normalizedElementTagName(e)
        var T = e.className
        var y = e.parentElement
        if (y) {
          for (var A = y.children, S = ((u = 0), A.length); u < S; ++u) {
            var N = A[u]
            if (
              N !== e &&
              normalizedElementTagName(N) === v &&
              N.className === T
            ) {
              var b = CandidateElement.candidateIfElementIsViable(
                N,
                this.contentDocument,
                true,
              )
              if (b && !(b.finalScore() < ReaderMinimumScore)) {
                this.article.element = y
                return
              }
            }
          }
        }
      }
    }
    findArticleBySearchingQuirksList() {
      var e
      var t = this.contentDocument
      findArticleNodeSelectorsInQuirksListForHostname(
        t.location.hostname,
        function (n) {
          var i = t.querySelectorAll(n)
          if (i.length === 1) {
            e = new CandidateElement(i[0], t)
            return true
          }
        }
      )
      return e
    }
    articleNode(someFlag) {
      this.checkForIframeCoveringMostOfWebpage()
      if (!this.didSearchForArticleNode) {
        console.log('try locate article: type 1')
        this.article = this.findArticleBySearchingQuirksList()
        if (!this.article) {
          console.log('try locate article: type 2')
          this.article = this.findArticleBySearchingAllElements()
        }
        if (!this.article) {
          console.log('try locate article: type 3')
          this.article = this.findArticleByVisualExamination()
        }
        if (!this.article) {
          console.log('try locate article: type 4')
          this.article = this.findArticleFromMetadata()
        }
        if (!this.article && someFlag) {
          console.log('try locate article: type 5')
          this.article = this.findArticleBySearchingAllElements(true)
        }
        this.didSearchForArticleNode = true
        this.adjustArticleNodeUpwardIfNecessary()
        if (this.article) {
          this.article.element = unwrappedArticleContentElement(
            this.article.element,
          )
        }
        if (this.article) {
          this.articleIsLTR()
        }
      }
      if (this.article) {
        return this.article.element
      } else {
        return null
      }
    }
    extraArticleNode() {
      if (!this.didSearchForArticleNode) {
        this.articleNode()
      }
      if (!this.didSearchForExtraArticleNode) {
        this.extraArticle = this.findExtraArticle()
        this.didSearchForExtraArticleNode = true
      }
      if (this.extraArticle) {
        return this.extraArticle.element
      } else {
        return null
      }
    }
    cacheWindowScrollPosition() {
      this._cachedScrollY = window.scrollY
      this._cachedScrollX = window.scrollX
    }
    contentTextStyle() {
      if (!this._cachedContentTextStyle) {
        this._cachedContentTextStyle = contentTextStyleForNode(
          this.contentDocument,
          this.articleNode(),
        )
        if (!this._cachedContentTextStyle) {
          this._cachedContentTextStyle = getComputedStyle(this.articleNode())
        }
      }
      return this._cachedContentTextStyle
    }
    commaCountIsLessThan(e, t) {
      for (
        var n = 0, i = e.textContent, r = -1;
        n < t && (r = i.indexOf(',', r + 1)) >= 0;

      ) {
        n++
      }
      return n < t
    }
    calculateLinkDensityForPruningElement(e, t) {
      var n = removeWhitespace(e.textContent).length
      if (!n) {
        return 0
      }
      for (
        var i = this.article.element,
        r = (function () {
          for (var t = e.originalElement; t && t !== i; t = t.parentElement) {
            if (getComputedStyle(t).float !== 'none') {
              return t
            }
          }
          return null
        })(),
        a = e.getElementsByTagName('a'),
        l = 0,
        o = a.length,
        s = 0;
        s < o;
        ++s
      ) {
        var c = a[s]
        if (
          !(
            !r &&
            c.href &&
            t &&
            t === dominantFontFamilyAndSizeForElement(c.originalElement)
          )
        ) {
          l += removeWhitespace(c.textContent).length
        }
      }
      return l / n
    }
    shouldPruneElement(e, t, n) {
      const i = 0.33
      const r = 0.5
      const a = 0.2
      const l = 25
      const o = 40000
      let s = normalizedElementTagName(e)
      if (!e.parentElement) {
        return false
      }
      if (t.classList.contains('footnotes')) {
        return false
      }
      if (e.querySelector('.tweet-wrapper')) {
        return false
      }
      if (
        normalizedElementTagName(e.parentElement) === 'figure' &&
        e.querySelector('img')
      ) {
        return false
      }
      if (s === 'iframe') {
        return shouldPruneIframe(e)
      }
      if (s !== 'canvas') {
        for (var c = false, m = e.childNodes.length, d = 0; d < m; ++d) {
          var h = e.childNodes[d]
          var u = h.nodeType
          if (
            u === Node.ELEMENT_NODE ||
            (u === Node.TEXT_NODE && !isNodeWhitespace(h))
          ) {
            c = true
            break
          }
        }
        if (!c) {
          if (s === 'p') {
            var f = e.previousSibling
            var g = e.nextSibling
            if (
              f &&
              f.nodeType === Node.TEXT_NODE &&
              !isNodeWhitespace(f) &&
              g &&
              g.nodeType === Node.TEXT_NODE &&
              !isNodeWhitespace(g)
            ) {
              return false
            }
          }
          return true
        }
        if (s === 'p') {
          return false
        }
      }
      if (s === 'canvas') {
        return (
          (window.innerWidth === t.width && window.innerHeight === t.height) ||
          !(
            !ProgressiveLoadingRegex.test(t.className) ||
            normalizedElementTagName(t.nextElementSibling) !== 'img'
          ) ||
          !!canvasElementHasNoUserVisibleContent(t) ||
          normalizedElementTagName(e.parentNode) === 'cufon'
        )
      }
      if (e.closest('figure') && e.querySelector('picture')) {
        return false
      }
      var p = 0
      if (t) {
        if (VeryNegativeClassNameRegEx.test(t.className)) {
          return true
        }
        var E = t.className
        var v = t.getAttribute('id')
        if (PositiveRegEx.test(E)) {
          p++
        }
        if (PositiveRegEx.test(v)) {
          p++
        }
        if (NegativeRegEx.test(E)) {
          p--
        }
        if (NegativeRegEx.test(v)) {
          p--
        }
      }
      let T = this.isMediaWikiPage()
      if (p < 0 && !T) {
        return true
      }
      if (elementIsProtected(e)) {
        return false
      }
      if (s === 'ul' || s === 'ol') {
        if (t.querySelector('iframe') && t.querySelector('script')) {
          return true
        }
        var y = t.children
        var A = y.length
        if (!A && !/\S/.test(e.innerText)) {
          return true
        }
        var S = 0
        var N = 0
        for (d = 0; d < A; ++d) {
          var b = y[d]
          if (SharingRegex.test(b.className)) {
            S++
          } else {
            var x = b.children
            if (x.length === 1 && SharingRegex.test(x[0].className)) {
              S++
            }
          }
          if (NegativeRegEx.test(y[d].className)) {
            N++
          }
        }
        return (
          S / A >=
          MinimumRatioOfListItemsBeingRelatedToSharingToPruneEntireList ||
          N / A >= MinimumRatioOfListItemsBeingRelatedToSharingToPruneEntireList
        )
      }
      if (e.childElementCount === 1) {
        var C = e.firstElementChild
        if (normalizedElementTagName(C) === 'a') {
          return false
        }
        if (
          normalizedElementTagName(C) === 'span' &&
          C.className === 'converted-anchor' &&
          nearestAncestorElementWithTagName(C, 'table')
        ) {
          return false
        }
      }
      var D = e.getElementsByTagName('img')
      var I = D.length
      if (I) {
        var M = 0
        for (d = 0; d < I; ++d) {
          var L = D[d].originalElement
          if (isElementVisible(L)) {
            var w = cachedElementBoundingRect(L)
            M += (w.width / I) * (w.height / I)
          }
        }
        if (M > o) {
          return false
        }
      }
      if (!this.commaCountIsLessThan(e, 10)) {
        return false
      }
      var R = e.getElementsByTagName('p').length
      var F = e.getElementsByTagName('br').length
      var _ = R + Math.floor(F / 2)
      if (I > _ && s !== 'table') {
        return true
      }
      if (!e.closest('table') && !e._originalElementDepthInCollapsedArea && !T) {
        if (
          e.getElementsByTagName('li').length > _ &&
          dominantFontFamilyAndSizeForElement(t.querySelector('li')) !== n
        ) {
          return true
        }
        if (e.textContent.length < l && I !== 1) {
          return true
        }
        let i = this.calculateLinkDensityForPruningElement(e, n)
        if (p >= 1 && i > r) {
          return true
        }
        if (p < 1 && i > a) {
          return true
        }
      }
      if (e.getElementsByTagName('input').length / _ > i) {
        return true
      }
      if (s === 'table') {
        if (
          removeWhitespace(e.innerText).length <=
          removeWhitespace(t.innerText).length * 0.5
        ) {
          return true
        }
        if (T && t.classList.contains('toc')) {
          return true
        }
      }
      return false
    }
    wordCountIsLessThan(e, t) {
      for (
        var n = 0, i = e.textContent, r = -1;
        (r = i.indexOf(' ', r + 1)) >= 0 && n < t;

      ) {
        n++
      }
      return n < t
    }
    leadingMediaIsAppropriateWidth(e) {
      return (
        !(!this.article || !e) &&
        e.getBoundingClientRect().width >=
        this.article.element.getBoundingClientRect().width -
        ToleranceForLeadingMediaWidthToArticleWidthForFullWidthPresentation
      )
    }
    newDivFromNode(e) {
      var t = this.contentDocument.createElement('div')
      if (e) {
        t.innerHTML = e.innerHTML
      }
      return t
    }
    headerElement() {
      if (!this.article) {
        return null
      }
      var e = this.article.element.previousElementSibling
      if (e && normalizedElementTagName(e) === 'header') {
        return e
      }
      var t = this._articleTitleElement
      if (!t) {
        return null
      }
      var n = t.parentElement
      if (
        n &&
        normalizedElementTagName(n) === 'header' &&
        !this.article.element.contains(n)
      ) {
        for (var i = n.querySelectorAll('img'), r = i.length, a = 0; a < r; ++a) {
          var l = i[a]
          var o = cachedElementBoundingRect(l)
          if (
            o.width >= MainImageMinimumWidthAndHeight &&
            o.height >= MainImageMinimumWidthAndHeight
          ) {
            return n
          }
        }
      }
      return null
    }
    adoptableLeadingMedia() {
      if (
        !this.article ||
        !this._leadingMediaElement ||
        !this.leadingMediaIsAppropriateWidth(this._leadingMediaElement)
      ) {
        return null
      }
      var e = this._leadingMediaElement.closest('figure')
      if (e) {
        return this.cleanArticleNode(e, e.cloneNode(true), 2, true)
      }
      if (normalizedElementTagName(this._leadingMediaElement) !== 'img') {
        return this.cleanArticleNode(
          this._leadingMediaElement,
          this._leadingMediaElement.cloneNode(true),
          2,
          true,
        )
      }
      const t = 5
      const n = /credit/
      const i = /caption/
      const r = /src|alt/
      var a = this._leadingMediaElement.parentNode
      var l = null
      var o = null
      var s = a.children.length
      if (normalizedElementTagName(a) === 'div' && s > 1 && s < t) {
        for (
          var c = a.cloneNode(true).querySelectorAll('p, div'),
          m = c.length,
          d = 0;
          d < m;
          ++d
        ) {
          var h = c[d]
          if (n.test(h.className)) {
            l = h.cloneNode(true)
          } else if (i.test(h.className)) {
            o = h.cloneNode(true)
          }
        }
      }
      var u = this._leadingMediaElement.cloneNode(false)
      var f = lazyLoadingImageURLForElement(u, u.className)
      if (f) {
        u.setAttribute('src', f)
      }
      if (!((!f && u.hasAttribute('src')) || !u.hasAttribute('data-srcset'))) {
        u.setAttribute('srcset', u.getAttribute('data-srcset'))
      }
      var g = attributesForElement(u)
      for (d = 0; d < g.length; ++d) {
        var p = g[d].nodeName
        if (!r.test(p)) {
          u.removeAttribute(p)
          d--
        }
      }
      var E = this.contentDocument.createElement('div')
      E.className = 'leading-image'
      E.appendChild(u)
      if (l) {
        var v = this.newDivFromNode(l)
        v.className = 'credit'
        E.appendChild(v)
      }
      if (o) {
        var T = this.newDivFromNode(o)
        T.className = 'caption'
        E.appendChild(T)
      }
      return E
    }
    articleBoundingRect() {
      if (!this._articleBoundingRect) {
        this._articleBoundingRect = cachedElementBoundingRect(
          this.article.element,
        )
      }
      return this._articleBoundingRect
    }
    adoptableArticle(someFlag) {
      let totalStartTime = Date.now()

      // 检查缓存
      if (this._adoptableArticle) {
        console.log('ReaderArticleFinderJS: Using cached adoptable article:', Date.now() - totalStartTime, 'ms')
        return this._adoptableArticle.cloneNode(true)
      }

      // 清除缓存和准备工作
      let time = Date.now()
      clearCachedElementBoundingRects()
      this.cacheWindowScrollPosition()
      console.log('ReaderArticleFinderJS: Cache clearing time:', Date.now() - time, 'ms')
      time = Date.now()

      // 获取文章节点
      var article = this.articleNode(someFlag)
      console.log('ReaderArticleFinderJS: locate article node time:', Date.now() - time, 'ms')
      time = Date.now()

      this._adoptableArticle = article ? article.cloneNode(true) : null
      console.log('ReaderArticleFinderJS: Article node cloning time:', Date.now() - time, 'ms')
      time = Date.now()
      if (!this._adoptableArticle) {
        console.log('ReaderArticleFinderJS: No article found:', Date.now() - totalStartTime, 'ms')
        return null
      }
      // 清理文章节点
      this._adoptableArticle = this.cleanArticleNode(
        article,
        this._adoptableArticle,
        0,
        false,
      )
      console.log('ReaderArticleFinderJS: Article cleaning time:', Date.now() - time, 'ms')

      // 处理段落元素
      if (normalizedElementTagName(this._adoptableArticle) === 'p') {
        var n = document.createElement('div')
        n.appendChild(this._adoptableArticle)
        this._adoptableArticle = n
      }

      // 处理额外文章内容
      time = Date.now()
      var extraArticle = this.extraArticleNode()
      if (extraArticle) {
        var r = this.cleanArticleNode(extraArticle, extraArticle.cloneNode(true), 0, true)
        if (r) {
          if (this.extraArticle.isPrepended) {
            this._adoptableArticle.insertBefore(
              r,
              this._adoptableArticle.firstChild,
            )
          } else {
            this._adoptableArticle.appendChild(r)
          }
        } else {
          extraArticle = null
        }

        // 计算边界矩形
        var a = cachedElementBoundingRect(this.article.element)
        var l = cachedElementBoundingRect(this.extraArticle.element)
        var o = {
          top: Math.min(a.top, l.top),
          right: Math.max(a.right, l.right),
          bottom: Math.max(a.bottom, l.bottom),
          left: Math.min(a.left, l.left),
        }
        o.width = o.right - o.left
        o.height = o.bottom - o.top
        this._articleBoundingRect = o
      }
      console.log('ReaderArticleFinderJS: Extra article processing time:', Date.now() - time, 'ms')

      // 保存文章文本内容
      time = Date.now()
      this._articleTextContent = this._adoptableArticle.innerText
      console.log('ReaderArticleFinderJS: Text content extraction time:', Date.now() - time, 'ms')

      // 处理头部元素和媒体内容
      time = Date.now()
      var s = this.headerElement()
      if (
        this._leadingMediaElement &&
        (!s || !s.contains(this._leadingMediaElement))
      ) {
        var c = this.adoptableLeadingMedia()
        if (c) {
          this._adoptableArticle.insertBefore(
            c,
            this._adoptableArticle.firstChild,
          )
        }
      }

      var m = !!s
      if (m && extraArticle && (extraArticle === s && (m = false), m)) {
        var d = extraArticle.compareDocumentPosition(s)
        if (
          d & Node.DOCUMENT_POSITION_CONTAINS ||
          d & Node.DOCUMENT_POSITION_CONTAINED_BY
        ) {
          m = false
        }
      }

      if (m) {
        var h = this.cleanArticleNode(s, s.cloneNode(true), 0, true)
        if (h) {
          this._adoptableArticle.insertBefore(
            h,
            this._adoptableArticle.firstChild,
          )
        }
      }
      console.log('ReaderArticleFinderJS: Header and media processing time:', Date.now() - time, 'ms')

      console.log('ReaderArticleFinderJS: Total adoptable article processing time:', Date.now() - totalStartTime, 'ms')
      return this._adoptableArticle
    }
    dominantContentSelectorAndDepth(root) {
      const time = Date.now()
      var t
      var elMap = {}
      var depthMap = {}
      let processedCount = 0
      walkElementSubtree(root, 2, function (e, t) {
        if (processedCount++ > MAX_NODES) {
          return true
        }
        if (isElementVisible(e)) {
          var selector = selectorForElement(e) + ' | ' + t
          if (depthMap[selector]) {
            depthMap[selector] += 1
          } else {
            depthMap[selector] = 1
            elMap[selector] = e
          }
        }
      })
      var sorted = arrayOfKeysAndValuesOfObjectSortedByValueDescending(depthMap)
      switch (sorted.length) {
        case 0:
          break
        case 1:
          t = sorted[0].key
          break
        default:
          var a = sorted[0]
          if (a.value > sorted[1].value) {
            t = a.key
          }
      }
      if (!t) {
        return null
      }
      var l = elMap[t]
      console.log('ReaderArticleFinderJS: Dominant content selector and depth time:', Date.now() - time, 'ms')
      return {
        selector: selectorForElement(l),
        depth: depthOfElementWithinElement(l, root),
      }
    }
    functionToPreventPruningElementDueToInvisibility() {
      return (
        functionToPreventPruningDueToInvisibilityInQuirksListForHostname(
          this.contentDocument.location.hostname,
        ) ||
        function () {
          return false
        }
      )
    }
    cleanArticleNode(article, clonedArticle, articleType, flag) {
      function addDepth(delta) {
        depth += delta
        if (T) {
          T += delta
        }
        if (y) {
          y += delta
        }
        if (A) {
          A += delta
        }
        if (S) {
          S += delta
        }
        if (N) {
          N += delta
        }
      }
      function a() {
        if (T === 1) {
          T = 0
        }
        if (y === 1) {
          y = 0
        }
        if (A === 1) {
          A = 0
        }
        if (S === 1) {
          S = 0
        }
        if (N === 1) {
          N = 0
        }
      }
      function l() {
        const t = 0.8
        var n = cachedElementBoundingRect(article)
        if (n.width === 0 || n.height === 0) {
          return true
        }
        var i
        var r = childrenWithParallelStructure(article)
        var a = r.length
        if (a) {
          i = []
          for (var l = 0; l < a; ++l) {
            var o = r[l]
            if (getComputedStyle(o).float === 'none') {
              for (var s = o.children, c = s.length, m = 0; m < c; ++m) {
                i.push(s[m])
              }
            } else {
              i.push(o)
            }
          }
        } else {
          i = article.children
        }
        var d = i.length
        var h = 0
        for (l = 0; l < d; ++l) {
          var u = i[l]
          if (getComputedStyle(u).float !== 'none') {
            h += u.innerText.length
          }
        }
        return h / article.innerText.length > t
      }
      function o(t) {
        const n = 50
        if (cachedElementBoundingRect(t).height > n) {
          return false
        }
        return (
          !!new Set(['ul', 'li', 'nav']).has(normalizedElementTagName(t)) ||
          (t.parentElement === article && !t.nextElementSibling)
        )
      }
      function s(e, t) {
        const n = 0.9
        return !(
          cachedElementBoundingRect(e).height >
          n * cachedElementBoundingRect(t).height
        )
      }
      function c(e, t) {
        const n = 1.1
        const i = 1.4
        if (t && fontSizePoints) {
          if (!e.matches(HeaderElementsSelector)) {
            if (
              (t > i * fontSizePoints || (V.test(originalEl.className) && t > n * fontSizePoints)) &&
              !e.closest('.pullquote')
            ) {
              e.classList.add('pullquote')
              if (!e.classList.contains('float')) {
                e.style.width = null
                cleanStyleAndClassList(e)
              }
            }
          }
        }
      }
      function m(e, t) {
        for (var n = e[t]; n; n = n[t]) {
          if (!isNodeWhitespace(n) && n.nodeType !== Node.COMMENT_NODE) {
            return false
          }
        }
        return true
      }
      const d = new Set([
        'form',
        'script',
        'style',
        'link',
        'button',
        'object',
        'embed',
        'applet',
      ])
      const h = new Set([
        'div',
        'table',
        'ul',
        'canvas',
        'p',
        'iframe',
        'aside',
        'section',
        'footer',
        'nav',
        'ol',
        'menu',
        'svg',
      ])
      const u = new Set(['i', 'em'])
      const f = new Set(['b', 'strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
      const g = new Set(['i-amphtml-sizer'])
      const p = /lightbox/i
      var listE = []
      var depth = 0
      var T = 0
      var y = 0
      var A = 0
      var S = 0
      var N = 0
      var originalEl = article
      var win = originalEl.ownerDocument.defaultView
      const t1 = Date.now()
      var el = clonedArticle
      // 为了节省执行时间，不执行 title, 作者，日期等的查找动作
      // var title = this.articleTitle()
      // var titleEl = this._articleTitleElement
      // this.articleSubhead()
      // var subheadEl = this._articleSubheadElement
      var title = document.title
      var titleEl = null
      var subheadEl = null
      var titleInsideArticle =
        titleEl &&
        cachedElementBoundingRect(titleEl).top > cachedElementBoundingRect(article).bottom
      var isVisible = isElementVisible(article)
      var titleSet = new Set([titleEl, subheadEl])
      const t2 = Date.now()
      var dateAndBySet = new Set()
      if (articleType === 0) {
        // this.updateArticleBylineAndDateElementsIfNecessary()
        // var articleBy = this.articleBylineElement()
        // if (articleBy) {
        //   dateAndBySet.add(articleBy)
        // }
        // var articleDate = this.articleDateElement()
        // if (articleDate) {
        //   dateAndBySet.add(articleDate)
        // }
      }
      var depthInfo = this.dominantContentSelectorAndDepth(article)
      var B = l()
      var urlSet = new Set()
      this.previouslyDiscoveredPageURLStrings.forEach(function (e) {
        urlSet.add(e)
      })
      // var q = this.nextPageURL()
      // if (q) {
      //   k.add(q)
      // }
      const t3 = Date.now()
      var titleRect = null
      if (this._articleTitleElement) {
        titleRect = cachedElementBoundingRect(this._articleTitleElement)
      }
      var shouldPrune = this.functionToPreventPruningElementDueToInvisibility()
      var fontInfo = dominantFontFamilyAndSizeForElement(article)
      var fontSizePoints = dominantFontSizeInPointsFromFontFamilyAndSizeString(fontInfo)

      const startTime = Date.now()
      console.log('preprocess time cost', { stage1: t2 - t1, stage2: t3 - t2, stage3: startTime - t3 })
      const V = /pull(ed)?quote/i
      var j = [], listG = [], X = [], Y = [], K = []
      let processedNodeCount = 0
      const MAX_EXECUTION_TIME = 1000
      while (originalEl) {
        // 检查限制条件
        if (processedNodeCount >= MAX_NODES ||
          Date.now() - startTime > MAX_EXECUTION_TIME) {
          console.warn('Breaking processing due to limits:', {
            nodes: processedNodeCount,
            time: Date.now() - startTime,
          })
          let _current = el
          // 1. 删除所有后续兄弟节点
          while (_current.nextElementSibling) {
            _current.nextElementSibling.remove()
          }
          // 2. 向上回溯到根节点，每一层都删除后续兄弟节点
          while (_current !== clonedArticle) {
            _current = _current.parentElement
            let nextSibling = _current.nextElementSibling
            while (nextSibling) {
              nextSibling.remove()
              nextSibling = _current.nextElementSibling
            }
          }
          break
        }
        processedNodeCount++
        try {
          var style
          var J = null
          var tagName = normalizedElementTagName(el)
          var Z = false
          var isDropCap = elementLooksLikeDropCap(originalEl)
          el.originalElement = originalEl
          if (!N && elementAppearsToBeCollapsed(originalEl)) {
            N = 1
          }
          if (d.has(tagName) || (this.isAMPPage() && g.has(tagName))) {
            J = el
          }
          if (!J && originalEl !== article && titleSet.has(originalEl)) {
            J = el
          } else if (!J && originalEl !== article && dateAndBySet.has(originalEl)) {
            el.parentElementBeforePruning = el.parentElement
            J = el
            j.push(el)
          } else if (
            elementIsAHeader(el) &&
            previousLeafElementForElement(originalEl) === titleEl
          ) {
            el.classList.add('protected')
          }
          if (tagName === 'twitter-widget') {
            el.classList.add('protected')
          }
          if (!J && (tagName === 'h1' || tagName === 'h2')) {
            if (originalEl.offsetTop - article.offsetTop < HeaderMinimumDistanceFromArticleTop) {
              var te = trimmedInnerTextIgnoringTextTransform(originalEl)
              var ne = te.length * HeaderLevenshteinDistanceToLengthRatio
              if (levenshteinDistance(title, te) <= ne) {
                J = el
              }
            }
          }
          if (!J) {
            if (
              this.isMediaWikiPage() &&
              /editsection|icon-edit|edit-page|mw-empty-elt/.test(originalEl.className)
            ) {
              J = el
            }
          }
          if (tagName === 'video') {
            if (el.getAttribute('src')) {
              el.classList.add('protected')
              var ie = cachedElementBoundingRect(originalEl)
              el.setAttribute('width', ie.width)
              el.setAttribute('height', ie.height)
              el.removeAttribute('style')
              if (
                originalEl.hasAttribute('autoplay') &&
                originalEl.hasAttribute('muted') &&
                originalEl.hasAttribute('loop')
              ) {
                el.setAttribute('data-reader-silent-looped-animation', '')
              } else {
                el.setAttribute('controls', true)
                el.removeAttribute('autoplay')
                el.removeAttribute('preload')
              }
            } else {
              J = el
            }
          }
          if (!J) {
            style = getComputedStyle(originalEl)
          }
          let t = (function () {
            if (tagName !== 'div' && tagName !== 'span') {
              return false
            }
            if (LazyLoadRegex.test(originalEl.className)) {
              return true
            }
            for (let e of attributesForElement(originalEl)) {
              if (
                /^data-/.test(e.name) &&
                LazyLoadRegex.test(e.value) &&
                cachedElementBoundingRect(originalEl).height
              ) {
                return true
              }
            }
            return false
          })()
          if (
            !J &&
            t &&
            (!originalEl.innerText ||
              (originalEl.previousElementSibling &&
                normalizedElementTagName(originalEl.previousElementSibling) ===
                'noscript'))
          ) {
            if ((Ie = lazyLoadingImageURLForElement(el, originalEl.className))) {
              var re = this.contentDocument.createElement('img')
              re.setAttribute('src', Ie)
              el.parentNode.replaceChild(re, el)
              el = re
              if (!el) {
                console.error('empty!', el)
              }
              el.originalElement = originalEl
              tagName = normalizedElementTagName(el)
              J = el
              el.classList.add('protected')
            }
          }
          if (!J && tagName !== 'img' && /img/.test(tagName)) {
            if (lazyLoadingImageURLForElement(el, originalEl.className)) {
              el = changeElementType(el, 'img')
              if (!el) {
                console.error('empty!', el)
              }
              el.originalElement = originalEl
              tagName = 'img'
            }
          }
          if (!J && tagName === 'div' && el.parentNode) {
            var ae = originalEl.querySelectorAll(
              'a, blockquote, dl, div, img, ol, p, pre, table, ul',
            )
            var le = T || style.float !== 'none'
            var oe = null
            if (le || ae.length) {
              if (
                elementIndicatesItIsASchemaDotOrgImageObject(originalEl) &&
                !el.querySelector('figure, .auxiliary')
              ) {
                oe = 'figure'
              } else if (isDropCap) {
                oe = 'span'
              }
            } else {
              oe = 'p'
            }
            if (oe) {
              for (
                var se = el.parentNode,
                span = this.contentDocument.createElement(oe);
                el.firstChild;

              ) {
                var me = el.firstChild
                span.appendChild(me)
              }
              se.replaceChild(span, el)
              el = span
              if (!el) {
                console.error('empty!', el)
              }
              el.originalElement = originalEl
              tagName = normalizedElementTagName(el)
            }
          }
          if (originalEl.dataset && originalEl.dataset.mathml && originalEl.querySelector('math')) {
            X.push(el)
          }
          if (!J && el.parentNode && h.has(tagName)) {
            el._originalElementDepthInCollapsedArea = N
            listE.push(el)
          }
          if (!J) {
            if (isElementPositionedOffScreen(originalEl)) {
              J = el
            } else if (
              !(
                originalEl === article ||
                T ||
                style.float === 'none' ||
                B ||
                !(
                  cachedElementBoundingRect(originalEl).height >= FloatMinimumHeight ||
                  originalEl.childElementCount > 1
                )
              )
            ) {
              T = 1
            }
          }
          if (!J) {
            sanitizeElementByRemovingAttributes(el)
            if (articleType === 1) {
              if (el.innerText === '|') {
                el.innerText = ''
                el.classList.add('delimiter')
              } else if (normalizedElementTagName(el) === 'time') {
                var de = el.previousElementSibling
                if (
                  de &&
                  normalizedElementTagName(de) === 'span' &&
                  !de.classList.contains('delimiter')
                ) {
                  var he = this.contentDocument.createElement('span')
                  he.classList.add('delimiter')
                  el.before(he)
                }
              } else if (tagName === 'figure') {
                J = el
              }
            }
            if (style.clear === 'both') {
              el.classList.add('clear')
            }
            if (tagName === 'ul' || tagName === 'ol' || tagName === 'menu') {
              if (titleRect && !N && cachedElementBoundingRect(originalEl).top < titleRect.top) {
                J = el
              } else if (
                style['list-style-type'] === 'none' &&
                style['background-image'] === 'none'
              ) {
                for (
                  var ue = originalEl.children, fe = ue.length, ge = true, i = 0;
                  i < fe;
                  ++i
                ) {
                  var Ee = ue[i]
                  var ve = getComputedStyle(Ee)
                  if (
                    ve['list-style-type'] !== 'none' ||
                    parseInt(ve['-webkit-padding-start']) !== 0
                  ) {
                    ge = false
                    break
                  }
                  var Te = getComputedStyle(Ee, ':before').content
                  if (/\u2022|\u25e6|\u2023|\u2219|counter/.test(Te)) {
                    ge = false
                    break
                  }
                }
                if (ge) {
                  el.classList.add('list-style-type-none')
                }
              }
              if (originalEl.querySelector('code')) {
                const e = /monospace|menlo|courier/i
                var ye = dominantFontFamilyAndSizeForElement(originalEl)
                if (e.test(ye)) {
                  el.classList.add('code-block')
                  el.classList.add('protected')
                }
              }
            }
            if (!(A || style.fontStyle === 'normal')) {
              if (!u.has(tagName)) {
                if (el.style) {
                  el.style.fontStyle = style.fontStyle
                }
              }
              A = 1
            }
            if (!S && style.fontWeight !== 'normal') {
              if (!f.has(tagName)) {
                var Ae = parseInt(style.fontWeight)
                var Se = null
                if (isNaN(Ae)) {
                  Se = style.fontWeight
                } else if (!(Ae <= 400)) {
                  if (Ae >= 500) {
                    Se = 'bold'
                  }
                }
                if (Se && el.style) {
                  el.style.fontWeight = Se
                }
              }
              S = 1
            }
            if ((T && tagName !== 'section' && s(originalEl, article)) || tagName === 'aside') {
              ye = dominantFontFamilyAndSizeForElement(originalEl)
              var Ne = dominantFontSizeInPointsFromFontFamilyAndSizeString(ye)
              var be = ye && ye === fontInfo
              if (!(T !== 1 || isDropCap)) {
                if (cachedElementBoundingRect(originalEl).width <= MaximumFloatWidth) {
                  el.setAttribute('class', 'auxiliary float ' + style.float)
                } else if (!be) {
                  el.classList.add('auxiliary')
                }
              }
              if (el.closest('.auxiliary') && originalEl.style) {
                var xe = originalEl.style.getPropertyValue('width')
                if (style.display === 'table' && /%/.test(xe) && parseInt(xe) < 2) {
                  el.style.width = style.width
                } else if (xe) {
                  el.style.width = xe
                } else {
                  var Ce = win.getMatchedCSSRules(originalEl, '', true)
                  if (Ce) {
                    for (i = Ce.length - 1; i >= 0; --i) {
                      xe = Ce[i].style.getPropertyValue('width')
                      var De = parseInt(xe)
                      if (xe && (isNaN(De) || De > 0)) {
                        el.style.width = xe
                        break
                      }
                    }
                  }
                }
                if (!(T !== 1 || xe)) {
                  el.style.width = cachedElementBoundingRect(originalEl).width + 'px'
                }
              }
              if (!isDropCap) {
                c(el, Ne)
              }
            }
            if (tagName === 'table') {
              if (!y) {
                y = 1
              }
            } else if (tagName === 'img') {
              var Ie
              if ((Ie = lazyLoadingImageURLForElement(el, originalEl.className))) {
                el.setAttribute('src', Ie)
                var Me = !!el.closest('figure')
                if (!Me) {
                  var Le = attributesForElement(originalEl)
                  var we = Le.length
                  for (i = 0; i < we; ++i) {
                    if (p.test(Le[i].nodeName)) {
                      Me = true
                      break
                    }
                  }
                }
                if (Me) {
                  el.classList.add('protected')
                }
                Z = true
              }
              if (
                !(
                  (!Ie && el.hasAttribute('src')) ||
                  !originalEl.hasAttribute('data-srcset')
                )
              ) {
                el.setAttribute('srcset', originalEl.getAttribute('data-srcset'))
              }
              el.removeAttribute('border')
              el.removeAttribute('hspace')
              el.removeAttribute('vspace')
              var Re = el.getAttribute('align')
              el.removeAttribute('align')
              if (!(Re !== 'left' && Re !== 'right')) {
                el.classList.add('float')
                el.classList.add(Re)
              }
              if (!T && !Z) {
                var Fe
                var _e = (Fe = cachedElementBoundingRect(originalEl)).width
                var Oe = Fe.height
                if (
                  hasClassMatchingRegexp(originalEl, ProgressiveLoadingRegex) &&
                  originalEl.nextElementSibling &&
                  normalizedElementTagName(originalEl.nextElementSibling) === 'img'
                ) {
                  J = el
                } else if (
                  imageIsContainedByContainerWithImageAsBackgroundImage(originalEl)
                ) {
                  el.classList.add('protected')
                } else if (
                  (_e === 1 && Oe === 1) ||
                  (titleRect &&
                    Oe < MinimumHeightForImagesAboveTheArticleTitle &&
                    Fe.bottom < titleRect.top)
                ) {
                  J = el
                } else if (_e < ImageSizeTiny && Oe < ImageSizeTiny) {
                  el.setAttribute('class', 'reader-image-tiny')
                }
              }
              if (articleType === 1) {
                if (
                  (Fe = cachedElementBoundingRect(originalEl)).width >
                  MaximumWidthOrHeightOfImageInMetadataSection ||
                  Fe.height > MaximumWidthOrHeightOfImageInMetadataSection
                ) {
                  J = el
                }
              }
              if (originalEl.classList.contains('emoji')) {
                let e = urlFromString(el.src)
                if (
                  e &&
                  e.hostname === 's.w.org' &&
                  e.pathname.startsWith('/images/core/emoji/')
                ) {
                  let e = this.replaceImageWithAltText(el)
                  if (e) {
                    el = e
                    if (!el) {
                      console.error('empty!', el)
                    }
                    el.originalElement = originalEl
                    tagName = normalizedElementTagName(el)
                    J = el
                    el.classList.add('protected')
                  }
                }
              }
            } else if (tagName === 'font') {
              el.removeAttribute('size')
              el.removeAttribute('face')
              el.removeAttribute('color')
            } else if (tagName === 'a' && el.parentNode) {
              let e
              let t
              if (el instanceof HTMLAnchorElement) {
                e = el.getAttribute('href')
                t = HTMLAnchorElement
              } else if (el instanceof SVGAElement) {
                e = el.getAttribute('xlink:href')
                t = SVGAElement
              }
              let i = el.originalElement.ownerDocument.location
              let r = urlStringShouldHaveItsAnchorMadeNonFunctional(e, i)
              if (
                t === HTMLAnchorElement &&
                originalEl.getAttribute('itemprop') === 'author'
              ) {
                el.classList.add('protected')
              } else if (e && e.length && (e[0] === '#' || r)) {
                const e = new Set(['li', 'sup'])
                if (
                  !y &&
                  !el.childElementCount &&
                  el.parentElement.childElementCount === 1 &&
                  !e.has(normalizedElementTagName(el.parentElement))
                ) {
                  if (
                    !this.contentDocument.evaluate(
                      'text()',
                      el.parentElement,
                      null,
                      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                      null,
                    ).snapshotLength
                  ) {
                    J = el
                  }
                }
                if (!J) {
                  span = this.contentDocument.createElement('span')
                  if (
                    el.childElementCount === 1 &&
                    normalizedElementTagName(el.firstElementChild) === 'img'
                  ) {
                    var firstChild = el.firstElementChild
                    if (
                      firstChild.width > AnchorImageMinimumWidth &&
                      firstChild.height > AnchorImageMinimumHeight
                    ) {
                      span.setAttribute('class', 'converted-image-anchor')
                    }
                  }
                  // 如果 span 没有 class，设置默认 class
                  if (!span.className) {
                    span.setAttribute('class', 'converted-anchor')
                  }
                  // 将 node 的所有子节点转移到 span 中
                  while (el.firstChild) {
                    span.appendChild(el.firstChild)
                  }
                  el.parentNode.replaceChild(span, el)
                  el = span
                  if (!el) {
                    console.error('empty!', el)
                  }
                  el.originalElement = originalEl
                }
              } else if (AdvertisementHostRegex.test(el.host) && !el.innerText) {
                J = el
              } else if (
                articleType !== 1 &&
                titleEl &&
                !titleInsideArticle &&
                titleEl.compareDocumentPosition(originalEl) &
                document.DOCUMENT_POSITION_PRECEDING &&
                cachedElementBoundingRect(originalEl).top <
                cachedElementBoundingRect(titleEl).top
              ) {
                listG.push(el)
              } else {
                var Be = originalEl.children
                if (
                  Be.length === 1 &&
                  normalizedElementTagName(Be[0]) === 'img' &&
                  !originalEl.innerText &&
                  anchorLooksLikeDownloadFlashLink(originalEl)
                ) {
                  J = el
                }
              }
              if (r) {
                el.removeAttribute('xlink:href')
                el.removeAttribute('href')
              }
            } else if (
              tagName === 'aside' ||
              tagName === 'blockquote' ||
              tagName === 'q' ||
              (tagName === 'div' && V.test(originalEl.className))
            ) {
              ye = dominantFontFamilyAndSizeForElement(originalEl)
              Ne = dominantFontSizeInPointsFromFontFamilyAndSizeString(ye)
              if (!isDropCap) {
                c(el, Ne)
              }
            } else if (tagName === 'cite') {
              var ke = pseudoElementContent(originalEl, 'after')
              if (ke) {
                var _span = document.createElement('span')
                _span.innerText = ke
                el.after(_span)
              }
            } else if (tagName === 'pre') {
              el.style.whiteSpace = style.whiteSpace
            } else if (tagName === 'source' && originalEl.hasAttribute('data-srcset')) {
              el.setAttribute('srcset', originalEl.getAttribute('data-srcset'))
              el.classList.add('protected')
            } else if (
              el instanceof SVGAnimateElement &&
              el.attributes.attributeName.value === 'xlink:href'
            ) {
              J = el
            }
          }
          if (style && isVisible && !Z) {
            var isInvisible =
              style.display === 'none' ||
              style.visibility !== 'visible' ||
              computedStyleIndicatesElementIsInvisibleDueToClipping(style)
            if (!(isInvisible || tagName === 'img')) {
              isInvisible =
                style.opacity === '0' &&
                style.position === 'absolute' &&
                !el.closest('figure')
            }
            if (isInvisible && !N) {
              if (
                !(
                  (!!depthInfo &&
                    depth === depthInfo.depth &&
                    selectorForElement(originalEl) === depthInfo.selector) ||
                  shouldPrune(originalEl, article)
                )
              ) {
                J = el
              }
            }
          }
          if (!J && elementIsCommentBlock(originalEl)) {
            J = el
          }
          if (
            !J &&
            titleRect &&
            cachedElementBoundingRect(originalEl).top < titleRect.top &&
            VeryLiberalCommentRegex.test(originalEl.className) &&
            el.parentElement
          ) {
            J = el
          }
          if (!J && tagName === 'a' && urlSet.has(originalEl.href)) {
            for (
              var We, Ue, He = originalEl, Ve = el;
              (He = He.parentElement) && (Ve = Ve.parentElement);
            ) {
              const t = 10
              if (
                cachedElementBoundingRect(He).top -
                cachedElementBoundingRect(originalEl).top >
                t
              ) {
                break
              }
              if (He === article) {
                break
              }
              if (o(He)) {
                We = He
                Ue = Ve
              }
            }
            if (We) {
              J = Ue
              originalEl = We
              el = Ue
              if (!el) {
                console.error('empty!', el)
              }
              el.originalElement = originalEl
              tagName = normalizedElementTagName(el)
            }
            He = null
            Ve = null
            We = null
            Ue = null
          }
        } catch (e) {
          J = el
        }
        if (!(!J || J.parentElement || flag)) {
          J = null
        }
        if (tagName === 'div') {
          Y.push(el)
        } else if (tagName === 'aside') {
          K.push(el)
        }
        if (!J) {
          let e = this._weakMapOfOriginalElementToUniqueID.get(el.originalElement)
          if (!e) {
            e = this._nextUniqueID()
          }
          this._mapOfUniqueIDToOriginalElement.set(e, el.originalElement)
          el.setAttribute(this.elementReaderUniqueIDAttributeKey(), e)
          this._weakMapOfOriginalElementToUniqueID.set(el.originalElement, e)
        }
        var firstChild = J ? null : originalEl.firstElementChild
        if (firstChild && el.firstElementChild) {
          // go down
          originalEl = firstChild
          el = el.firstElementChild
          addDepth(1)
        } else {
          // go back
          var nextSibling
          while (originalEl !== article && !(nextSibling = originalEl.nextElementSibling)) {
            originalEl = originalEl.parentElement
            el = el.parentElement
            if (!el) {
              console.error('empty!', el)
            }
            addDepth(-1)
          }
          if (originalEl === article) {
            if (J && !elementIsProtected(J)) {
              if (J.parentElement) {
                J.remove()
              } else if (flag) {
                return null
              }
            }
            break
          }
          originalEl = nextSibling
          el = el.nextElementSibling
          if (!el) {
            console.error('empty!', el)
          }
          a()
        }
        if (J && !elementIsProtected(J)) {
          if (J.parentElement) {
            J.remove()
          } else if (flag) {
            return null
          }
        }
      }
      for (let e of clonedArticle.querySelectorAll('iframe')) {
        if (elementLooksLikeEmbeddedTweet(e.originalElement)) {
          if ((Xe = this.adoptableSimpleTweetFromTwitterElement(e))) {
            e.parentElement.replaceChild(Xe, e)
          }
        }
        e.classList.add('protected')
        e.setAttribute('sandbox', 'allow-scripts allow-same-origin')
      }
      for (let e of clonedArticle.querySelectorAll('twitter-widget')) {
        var Xe
        if (elementLooksLikeEmbeddedTweet(e.originalElement)) {
          if ((Xe = this.adoptableSimpleTweetFromTwitterElement(e))) {
            e.parentElement.replaceChild(Xe, e)
          }
        }
        e.classList.add('protected')
      }
      const blockQuotes = clonedArticle.querySelectorAll('blockquote')
      for (let i = 0; i < blockQuotes.length; ++i) {
        const e = blockQuotes[i]
        const t = e.originalElement
        if (t) {
          this.convertBlockquoteTweetToSimpleTweetIfAppropriate(e, t)
        }
      }
      for (let i = listE.length - 1; i >= 0; --i) {
        if (
          (_el = listE[i]).parentNode &&
          this.shouldPruneElement(_el, _el.originalElement, fontInfo)
        ) {
          _el.remove()
        }
        delete _el._originalElementDepthInCollapsedArea
      }
      for (let i = 0; i < listG.length; ++i) {
        listG[i].remove()
      }
      var floatElements = clonedArticle.querySelectorAll('.float')
      for (let i = 0; i < floatElements.length; ++i) {
        var $e = false
        var _el = floatElements[i]
        if (!$e) {
          var et = _el.querySelectorAll('a, span.converted-image-anchor')
          var tt = _el.querySelectorAll('span.converted-anchor')
          $e = _el.parentNode && tt.length > et.length
        }
        if (!$e) {
          var nt = _el.querySelectorAll('embed, object').length
          var it = _el.originalElement.querySelectorAll('embed, object').length
          if (!nt && it) {
            $e = true
          }
        }
        if (!$e) {
          for (
            var rt = _el.originalElement.getElementsByTagName('img'),
            at = rt.length,
            lt = 0,
            ot = 0;
            ot < at && (isVisible && isElementVisible(rt[ot]) && lt++, !(lt > 1));
            ++ot
          );
          if (lt === 1) {
            if (!_el.getElementsByTagName('img').length) {
              $e = true
            }
          }
        }
        if (!$e) {
          const e = 'img, video, embed, iframe, object, svg'
          if (
            !(/\S/.test(_el.innerText) || _el.matches(e) || _el.querySelector(e))
          ) {
            $e = true
          }
        }
        if ($e && !elementIsProtected(_el)) {
          _el.remove()
        }
      }
      var brElements = clonedArticle.querySelectorAll('br')
      for (let i = brElements.length - 1; i >= 0; --i) {
        var ct = brElements[i]
        if (
          ct.originalElement &&
          getComputedStyle(ct.originalElement.parentElement).display ===
          'block' &&
          (m(ct, 'nextSibling') || m(ct, 'previousSibling'))
        ) {
          ct.remove()
        }
      }
      if (
        flag &&
        !removeWhitespace(clonedArticle.innerText).length &&
        (articleType !== 2 || !clonedArticle.querySelector('video, iframe, img'))
      ) {
        return null
      }
      var mt = {}
      var dt = (et = clonedArticle.querySelectorAll('a')).length
      for (let i = 0; i < dt; ++i) {
        let _el = et[i]
        let fontWeight = _el.style.fontWeight
        if (!mt[fontWeight]) {
          mt[fontWeight] = []
        }
        mt[fontWeight].push(_el)
      }
      for (var ht in mt) {
        var ut = mt[ht]
        var ft = ut.length
        if (ft > dt * 0.7) {
          for (let i = 0; i < ft; ++i) {
            var _el = ut[i]
            _el.style.fontWeight = null
            if (!_el.getAttribute('style')) {
              _el.removeAttribute('style')
            }
          }
        }
      }
      var pt = clonedArticle.querySelectorAll('.protected')
      var Et = pt.length
      for (let i = 0; i < Et; ++i) {
        var _el = pt[i]
        _el.classList.remove('protected')
        if (!_el.classList.length) {
          _el.removeAttribute('class')
        }
      }
      var auxiliaryElements = clonedArticle.querySelectorAll('p.auxiliary')
      for (let i = 0; i < auxiliaryElements.length; ++i) {
        let _el = auxiliaryElements[i]
        let _res = [_el]
        for (
          let Nt = _el.nextElementSibling;
          Nt &&
          normalizedElementTagName(Nt) === 'p' &&
          Nt.classList.contains('auxiliary');

        ) {
          _res.push(Nt)
          Nt = Nt.nextElementSibling
        }
        var len = _res.length
        if (len > 1) {
          for (ot = 0; ot < len; ++ot) {
            var xt = _res[ot]
            xt.classList.remove('auxiliary')
            if (xt.style) {
              xt.style.width = null
            }
            cleanStyleAndClassList(xt)
          }
          i += len - 1
        }
      }
      for (let i = Y.length - 1; i >= 0; --i) {
        var Ct = Y[i]
        if (
          Ct !== clonedArticle &&
          elementWouldAppearBetterAsFigureOrAuxiliary(Ct.originalElement, Ct)
        ) {
          changeElementType(Ct, 'figure')
        }
      }
      for (let i = K.length - 1; i >= 0; --i) {
        var Dt = K[i]
        if (
          Dt !== clonedArticle &&
          elementWouldAppearBetterAsFigureOrAuxiliary(Dt.originalElement, Dt)
        ) {
          Dt.classList.add('auxiliary')
        }
      }
      for (let i = 0; i < j.length; ++i) {
        var Mt = j[i]
        var Lt = Mt.parentElementBeforePruning
        var wt = null
        var Rt = null
        if (Lt) {
          wt = depthOfElementWithinElement(Lt, clonedArticle)
          Rt = selectorForElement(Lt)
        }
        var Ft = Lt ? Lt.closest('ul') : null
        if (Ft) {
          Ft.remove()
        } else {
          const e = 40
          if (
            Lt &&
            cachedElementBoundingRect(Lt.originalElement).height < e &&
            (!depthInfo || depthInfo.selector !== Rt || depthInfo.depth !== wt)
          ) {
            Lt.remove()
          } else {
            Mt.remove()
          }
        }
      }
      var _t = X.length
      for (let i = 0; i < _t; ++i) {
        var Ot = X[i]
        var Pt = this.contentDocument.createElement('div')
        Pt.innerHTML = Ot.dataset ? Ot.dataset.mathml : ''
        Ot.parentNode.replaceChild(Pt, Ot)
      }
      return clonedArticle
    }
    convertBlockquoteTweetToSimpleTweetIfAppropriate(e, t) {
      const n = t.classList
      if (!n.contains('twitter-tweet') && !n.contains('twitter-video')) {
        return
      }
      const i = t.getElementsByTagName('a')
      const r = i.length
      if (r < 1) {
        return
      }
      const a = i[r - 1]
      if (a.host !== 'twitter.com') {
        return
      }
      const l = lastPathComponentFromAnchor(a)
      if (isNaN(parseInt(l))) {
        return
      }
      const o = this.contentDocument.createElement('div')
      o.setAttribute('data-reader-tweet-id', l)
      o.classList.add('tweet-wrapper')
      e.parentElement.replaceChild(o, e)
      e.classList.add('simple-tweet')
      o.appendChild(e)
    }
    adoptableSimpleTweetFromTwitterElement(e) {
      var t = function (e) {
        var t = this.contentDocument.createElement('div')
        var n = this.contentDocument.createTextNode(e)
        t.appendChild(n)
        return t.innerHTML
      }.bind(this)
      let n = null
      let i = e.originalElement
      if (normalizedElementTagName(e) === 'iframe') {
        n = i.contentDocument ? i.contentDocument.documentElement : null
      } else if (normalizedElementTagName(e) === 'twitter-widget') {
        n = i.shadowRoot
      }
      if (!n) {
        return null
      }
      var r =
        n.querySelector('[data-tweet-id].expanded') ||
        n.querySelector('[data-tweet-id]')
      if (!r) {
        return null
      }
      var a = this.contentDocument.createElement('div')
      a.classList.add('tweet-wrapper')
      var l = this.contentDocument.createElement('blockquote')
      l.classList.add('simple-tweet')
      a.appendChild(l)
      var o = r.getAttribute('data-tweet-id')
      a.setAttribute('data-reader-tweet-id', o)
      var s = r.querySelector('.dateline')
      var c = r.querySelector('[data-scribe="element:screen_name"]')
      var m = r.querySelector('[data-scribe="element:name"]')
      var d = r.querySelector('.e-entry-title')
      if (!(s && c && m && d)) {
        return a
      }
      var h = '&mdash; ' + t(m.innerText) + ' (' + t(c.innerText) + ')'
      var u = this.contentDocument.createElement('p')
      u.innerHTML = d.innerHTML
      l.appendChild(u)
      l.insertAdjacentHTML('beforeend', h)
      var f = this.contentDocument.createElement('span')
      f.innerHTML = s.innerHTML
      l.appendChild(f)
      for (let e of l.querySelectorAll('img.twitter-emoji')) {
        this.replaceImageWithAltText(e)
      }
      for (var g = l.getElementsByTagName('*'), p = g.length, E = 0; E < p; ++E) {
        e = g[E]
        if (normalizedElementTagName(e) === 'script') {
          e.remove()
        } else {
          sanitizeElementByRemovingAttributes(e)
        }
      }
      return a
    }
    replaceImageWithAltText(e) {
      var t = e.getAttribute('alt')
      if (!t || t.length < 1) {
        return null
      }
      let n = this.contentDocument.createElement('span')
      n.innerText = t
      e.parentNode.replaceChild(n, e)
      return n
    }
    leadingVideoNode() {
      var e = this.leadingContentNodeWithSelector('video, iframe')
      if (
        e &&
        e.parentElement &&
        !e.previousElementSibling &&
        !e.nextElementSibling
      ) {
        return e.parentElement
      } else {
        return null
      }
    }
    leadingImageNode() {
      return this.leadingContentNodeWithSelector('figure img, img')
    }
    ancestorsOfElement(e) {
      let t = []
      let n = e.parentNode
      for (; n;) {
        t.push(n)
        n = n.parentNode
      }
      return t
    }
    leadingContentNodeWithSelector(e) {
      const t = 250
      const n = 0.5
      const i = 0.9
      const r = 3
      if (!this.article || !this.article.element) {
        return null
      }
      let a = 0
      if (this._articleTitleElement) {
        let e
        let t = this.ancestorsOfElement(this.article.element)
        for (let n of t) {
          if (n.contains(this._articleTitleElement)) {
            e = n
            break
          }
        }
        a = t.length - this.ancestorsOfElement(e).length + 2
      }
      let l = Math.max(r, a)
      for (var o = this.article.element, s = 0; s < l && o.parentNode; ++s) {
        var c = (o = o.parentNode).querySelectorAll(e)
        for (var m of c) {
          if (m && isElementVisible(m)) {
            var d = cachedElementBoundingRect(m)
            if (!(d.width >= window.innerWidth * i) && d.height < t) {
              continue
            }
            if (d.width < this._articleWidth * n) {
              continue
            }
            var h = this.article.element.compareDocumentPosition(m)
            if (
              !(h & Node.DOCUMENT_POSITION_PRECEDING) ||
              h & Node.DOCUMENT_POSITION_CONTAINED_BY
            ) {
              continue
            }
            var u = this.extraArticle ? this.extraArticle.element : null
            if (
              u &&
              this.article.element.compareDocumentPosition(u) &
              Node.DOCUMENT_POSITION_FOLLOWING &&
              (h = u.compareDocumentPosition(m)) &&
              (!(h & Node.DOCUMENT_POSITION_PRECEDING) ||
                h & Node.DOCUMENT_POSITION_CONTAINED_BY)
            ) {
              continue
            }
            return m
          }
        }
      }
      return null
    }
    pageImageURLFromMetadata(e) {
      var t = e['property:og:image']
      if (!t) {
        t = e['property:twitter:image']
      }
      if (!t) {
        t = e['property:twitter:image:src']
      }
      if (t) {
        let e = urlFromString(t)
        if (e) {
          let n = e.href
          if (n && urlIsHTTPFamilyProtocol(e)) {
            t = n
          }
        }
      }
      return t
    }
    mainImageNode() {
      var e = this.leadingImageNode()
      if (e) {
        return e
      }
      if (this.article && this.article.element) {
        for (
          var t = this.article.element.querySelectorAll('img'),
          n = t.length,
          i = 0;
          i < n;
          ++i
        ) {
          var r = t[i]
          var a = r._cachedElementBoundingRect
          if (!a) {
            a = r.getBoundingClientRect()
          }
          if (
            a.width >= MainImageMinimumWidthAndHeight &&
            a.height >= MainImageMinimumWidthAndHeight
          ) {
            return r
          }
        }
      }
      return null
    }
    schemaDotOrgMetadataObjectForArticle() {
      if (this._schemaDotOrgMetadataObjectForArticle) {
        return this._schemaDotOrgMetadataObjectForArticle
      }
      const e = new Set([
        'Article',
        'NewsArticle',
        'Report',
        'ScholarlyArticle',
        'SocialMediaPosting',
        'BlogPosting',
        'LiveBlogPosting',
        'DiscussionForumPosting',
        'TechArticle',
        'APIReference',
      ])
      var t = this.contentDocument.querySelectorAll(
        "script[type='application/ld+json']",
      )
      var n = t.length
      try {
        for (var i = 0; i < n; ++i) {
          var r = t[i]
          var a = JSON.parse(r.textContent)
          var l = a['@context']
          if (l === 'https://schema.org' || l === 'http://schema.org') {
            var o = a['@type']
            if (e.has(o)) {
              this._schemaDotOrgMetadataObjectForArticle = a
              return a
            }
          }
        }
        return null
      } catch (e) {
        return null
      }
    }
    articleTitle() {
      var e = this.articleTitleInformation()
      if (e) {
        return e.titleText
      } else {
        return ''
      }
    }
    articleTitleInformation() {
      function e(e, t) {
        var n = e ? t.indexOf(e) : -1
        return n !== -1 && (n === 0 || n + e.length === t.length)
      }
      function t(e, t) {
        return e.host === t.host && e.pathname === t.pathname && e.hash === t.hash
      }
      function n(e) {
        let t = nearestAncestorElementWithTagName(e, 'a') || e.querySelector('a')
        if (t) {
          if (
            urlStringShouldHaveItsAnchorMadeNonFunctional(
              t.href,
              t.ownerDocument.location,
            )
          ) {
            return null
          } else {
            return t
          }
        } else {
          return null
        }
      }
      if (!this.articleNode()) {
        return
      }
      if (this._articleTitleInformation) {
        return this._articleTitleInformation
      }
      const i = /((article|post).*title|headline|instapaper_title|inside-head)/i
      const r = 600
      const a = 20
      const l = 8
      const o = 1.1
      const s = 1.25
      const c = /header|title|headline|instapaper_title/i
      const m = 1.5
      const d = 1.8
      const h = 1.5
      const u = 0.6
      const f = 3
      const g = 1.5
      const p = 0.8
      const E = 0.8
      const v = 9
      const T = 1.5
      const y = /byline|author/i
      var A = function (e, t) {
        var n = this.contentFromUniqueMetadataSelector(e, t)
        if (n) {
          var i = this.articleTitleAndSiteNameFromTitleString(n)
          if (i) {
            n = i.articleTitle
          }
        }
        return n
      }.bind(this)
      var S = function () {
        for (var e = this.articleNode(); e; e = e.parentElement) {
          if (elementIndicatesItIsASchemaDotOrgArticleContainer(e)) {
            return e
          }
        }
        return null
      }.bind(this)()
      var N = S
        ? this.contentFromUniqueMetadataSelector(S, 'meta[itemprop=headline]')
        : ''
      var b = S
        ? this.contentFromUniqueMetadataSelector(
          S,
          'meta[itemprop=alternativeHeadline]',
        )
        : ''
      var x = this.contentDocument
      var C = x.location
      var D = x.title
      var I = A(x, "meta[property='og:title']")
      var M = this.contentFromUniqueMetadataSelector(
        x,
        "meta[property='og:site_name']",
      )
      var L = A(x, "meta[name='twitter:title']")
      var w = A(x, "meta[name='sailthru.headline']")
      var R = this.schemaDotOrgMetadataObjectForArticle()
      var F = R ? R.headline : null
      var _ = this.articleNode()
      var O = cachedElementBoundingRect(_)
      if (this.extraArticleNode() && this.extraArticle.isPrepended) {
        O = cachedElementBoundingRect(this.extraArticleNode())
      }
      var P = O.left + O.width / 2
      var B = O.top
      var k = B
      this._articleWidth = O.width
      this._leadingMediaElement = this.leadingImageNode()
      if (!this._leadingMediaElement) {
        this._leadingMediaElement = this.leadingVideoNode()
      }
      if (this._leadingMediaElement) {
        k = (cachedElementBoundingRect(this._leadingMediaElement).top + B) / 2
      }
      var q = 'h1, h2, h3, h4, h5, a:not(svg a), p, div, span'
      var z = normalizedElementTagName(this.article.element)
      if (!(z !== 'dl' && z !== 'dd')) {
        q += ', dt'
      }
      for (
        var W = [], U = x.querySelectorAll(q), H = U.length, V = 0;
        V < H;
        ++V
      ) {
        var j = U[V]
        var G = normalizedElementTagName(j)
        if (G === 'a') {
          if (j.innerText === I && t(j, C)) {
            if (j.previousElementSibling || j.nextElementSibling) {
              W.push(j)
            } else {
              W.push(j.parentElement)
            }
          }
        } else if (G === 'div' || G === 'span' || G === 'p') {
          if (hasClassMatchingRegexp(j, i) || i.test(j.getAttribute('id'))) {
            var X = j.parentElement
            if (!elementIsAHeader(X)) {
              W.push(j)
            }
          }
        } else {
          W.push(j)
        }
      }
      W = Array.prototype.slice.call(W, 0)
      const Y = 2
      var K = this.article.element
      for (V = 0; V < Y; ++V) {
        if (K.parentElement) {
          K = K.parentElement
        }
      }
      for (
        var Q, J = K.querySelectorAll('a:not(svg a)'), $ = ((V = 0), J.length);
        V < $;
        ++V
      ) {
        var Z = J[V]
        if (Z.offsetTop > _.offsetTop + a) {
          break
        }
        if (t(Z, C) && Z.getAttribute('href') !== '#') {
          W.push(Z)
          break
        }
      }
      var ee = W.map(trimmedInnerTextIgnoringTextTransform)
      var te = W.length
      var ne = 0
      var ie = []
      var re = []
      var ae = []
      var le = []
      var oe = []
      var se = []
      var ce = []
      const me = {}
      const de = (e) => {
        const t = me[e]
        if (t) {
          return t
        }
        const n = stringSimilarity(D, e)
        me[e] = n
        return n
      }
      for (V = 0; V < te; ++V) {
        var he = W[V]
        var ue = ee[V]
        const e = {}
        const t = (t) => {
          const n = e[t]
          if (n) {
            return n
          }
          const i = stringSimilarity(ue, t)
          e[t] = i
          return i
        }
        let n = de(ue)
        if (I) {
          const e = t(I)
          n += e
          if (e > StringSimilarityToDeclareStringsNearlyIdentical) {
            re.push(he)
          }
        }
        if (L) {
          const e = t(L)
          n += e
          if (e > StringSimilarityToDeclareStringsNearlyIdentical) {
            ae.push(he)
          }
        }
        if (N) {
          const e = t(N)
          n += e
          if (e > StringSimilarityToDeclareStringsNearlyIdentical) {
            le.push(he)
          }
        }
        if (b) {
          const e = t(b)
          n += e
          if (e > StringSimilarityToDeclareStringsNearlyIdentical) {
            oe.push(he)
          }
        }
        if (w) {
          const e = t(w)
          n += e
          if (e > StringSimilarityToDeclareStringsNearlyIdentical) {
            se.push(he)
          }
        }
        if (F) {
          const e = t(F)
          n += e
          if (e > StringSimilarityToDeclareStringsNearlyIdentical) {
            ce.push(he)
          }
        }
        if (n === ne) {
          ie.push(he)
        } else if (n > ne) {
          ne = n
          ie = [he]
        }
      }
      let fe = []
      for (let e of W) {
        let t = e.nextElementSibling
        if (t && SubheadRegex.test(t.className)) {
          fe.push(e)
        }
      }
      if (re.length === 1) {
        ; (Q = re[0]).headerText = trimmedInnerTextIgnoringTextTransform(Q)
      } else if (ae.length === 1) {
        ; (Q = ae[0]).headerText = trimmedInnerTextIgnoringTextTransform(Q)
      } else if (le.length === 1) {
        ; (Q = le[0]).headerText = trimmedInnerTextIgnoringTextTransform(Q)
      } else if (se.length === 1) {
        ; (Q = se[0]).headerText = trimmedInnerTextIgnoringTextTransform(Q)
      } else if (ce.length === 1) {
        ; (Q = ce[0]).headerText = trimmedInnerTextIgnoringTextTransform(Q)
      }
      if (!Q) {
        for (V = 0; V < te; ++V) {
          he = W[V]
          if (!isElementVisible(he)) {
            continue
          }
          var ge = cachedElementBoundingRect(he)
          var pe = ge.left + ge.width / 2
          var Ee = pe - P
          var ve = ge.top + ge.height / 2 - k
          var Te = re.indexOf(he) !== -1
          var ye = ae.indexOf(he) !== -1
          var Ae = he.classList.contains('instapaper_title')
          var Se = /\bheadline\b/.test(he.getAttribute('itemprop'))
          var Ne = le.indexOf(he) !== -1
          var be = oe.indexOf(he) !== -1
          var xe = se.indexOf(he) !== -1
          var Ce = ce.indexOf(he) !== -1
          let t = fe.includes(he) && ve < 0
          var De = Te || ye || Ae || Se || Ne || be || xe || Ce || t
          var Ie = Math.sqrt(Ee * Ee + ve * ve)
          var Me = De ? r : Math.max(r - Ie, 0)
          ue = ee[V]
          var Le = he.getAttribute('property')
          if (Le) {
            var we = /dc.title/i.exec(Le)
            if (we && we[0]) {
              if (
                this.contentDocument.querySelectorAll(
                  '*[property~="' + we[0] + '"]',
                ).length === 1
              ) {
                ; (Q = he).headerText = ue
                break
              }
            }
          }
          if (!y.test(he.className)) {
            if (!De) {
              if (Ie > r) {
                continue
              }
              if (pe < O.left || pe > O.right) {
                continue
              }
            }
            if (D && stringsAreNearlyIdentical(ue, D)) {
              Me *= f
            } else if (e(ue, D)) {
              Me *= g
            } else if (ue.length < l) {
              continue
            }
            if (ue !== M || !I) {
              var Re = false
              if ((We = n(he))) {
                if (We.getAttribute('rel') === 'author') {
                  continue
                }
                var Fe = We.host === C.host
                var _e = We.pathname === C.pathname
                if (Fe && _e) {
                  Me *= h
                } else {
                  if (Fe && nearestAncestorElementWithTagName(he, 'li')) {
                    continue
                  }
                  Me *= u
                  Re = true
                }
              }
              var Oe = fontSizeFromComputedStyle(getComputedStyle(he))
              if (!Re) {
                Me *= Oe / BaseFontSize
              }
              Me *= 1 + TitleCandidateDepthScoreMultiplier * elementDepth(he)
              var Pe = parseInt(this.contentTextStyle().fontSize)
              if (parseInt(Oe) > Pe * o) {
                Me *= s
              }
              if (c.test(he.className) || c.test(he.getAttribute('id'))) {
                Me *= m
              }
              var Be = he.parentElement
              if (Be && (c.test(Be.className) || c.test(Be.getAttribute('id')))) {
                Me *= m
              }
              if (ie.indexOf(he) !== -1) {
                Me *= d
              }
              _ = this.article.element
              for (var ke = he; ke && ke !== _; ke = ke.parentElement) {
                if (SidebarRegex.test(ke.className)) {
                  Me *= p
                  break
                }
              }
              if (he.closest('li')) {
                Me *= E
              }
              if (!Q || Me > Q.headerScore) {
                ; (Q = he).headerScore = Me
                Q.headerText = ue
              }
            }
          }
        }
      }
      var qe
      if (
        Q &&
        domDistance(Q, _, v + 1) > v &&
        parseInt(getComputedStyle(Q).fontSize) < T * Pe
      ) {
        Q = null
      }
      if (Q) {
        this._articleTitleElement = Q
        var ze = Q.headerText.trim()
        qe = I && e(I, ze) ? I : D && e(D, ze) ? D : ze
      }
      if (!this._leadingMediaElement) {
        this._leadingMediaElement = this.leadingImageNode()
      }
      if (!this._leadingMediaElement) {
        this._leadingMediaElement = this.leadingVideoNode()
      }
      if (!qe) {
        qe = I && e(I, D) ? I : D
      }
      var We
      var Ue = null
      var He = false
      var Ve = false
      if (Q && (We = n(Q))) {
        Ue = We.href
        He = We.getAttribute('target') === '_blank'
        Ve = We.host !== C.host || We.pathname !== C.pathname
      }
      let je = {
        titleText: qe,
        linkURL: Ue,
        linkIsTargetBlank: He,
        linkIsForExternalPage: Ve,
      }
      if (this._articleTitleElement) {
        const e = this.titleUniqueID()
        this._mapOfUniqueIDToOriginalElement.set(e, Q)
        this._weakMapOfOriginalElementToUniqueID.set(Q, e)
      }
      this._articleTitleInformation = je
      return je
    }
    contentFromUniqueMetadataSelector(e, t) {
      var n = e.querySelectorAll(t)
      if (n.length !== 1) {
        return null
      }
      var i = n[0]
      if (i) {
        if (this.elementAttributesContainImproperQuote(i)) {
          return null
        } else {
          return i.content
        }
      } else {
        return null
      }
    }
    elementAttributesContainImproperQuote(e) {
      for (var t = attributesForElement(e), n = t.length, i = 0; i < n; ++i) {
        if (/['"]/.test(t[i].name)) {
          return true
        }
      }
      return false
    }
    articleSubhead() {
      function e(e) {
        if (elementIsAHeader(e)) {
          return parseInt(/h(\d)?/.exec(normalizedElementTagName(e))[1])
        } else {
          return NaN
        }
      }
      function t(e) {
        if (!e) {
          return null
        }
        var t = e.content
        if (t) {
          return t.trim()
        } else {
          return null
        }
      }
      const n = /author|kicker/i
      if (this._articleSubhead) {
        return this._articleSubhead
      }
      var i = this.articleNode()
      if (!i) {
        return
      }
      var r = this._articleTitleElement
      if (!r) {
        return
      }
      var a = this.contentDocument
      var l = a.location
      var o = e(r)
      var s = cachedElementBoundingRect(r)
      var c = new Set()
      var m = t(a.querySelector("meta[property='og:description']"))
      if (m) {
        c.add(m)
      }
      var d = t(a.querySelector('meta[name=description]'))
      if (d) {
        c.add(d)
      }
      var h
      var u = this.schemaDotOrgMetadataObjectForArticle()
      if (u) {
        var f = u.description
        if (f && typeof f == 'string') {
          c.add(f.trim())
        }
      }
      var g = this.contentFromUniqueMetadataSelector(
        a,
        'head meta.swiftype[name=dek]',
      )
      if (g) {
        h = g
      }
      let p = []
      let E = nextNonFloatingVisibleElementSibling(r)
      if (E) {
        p.push(E)
      }
      let v = nextLeafElementForElement(r)
      if (
        v &&
        r &&
        r.contains(v) &&
        v.innerText &&
        v.innerText.trim() === r.innerText.trim()
      ) {
        v = nextLeafElementForElement(v)
      }
      if (v) {
        p.push(v)
      }
      if (c.size) {
        for (
          var T = a.querySelectorAll(
            HeaderElementsSelector + ', *[itemprop=description]',
          ),
          y = T.length,
          A = 0;
          A < y;
          ++A
        ) {
          var S = T[A]
          if (c.has(S.innerText.trim())) {
            p.push(S)
          }
        }
      }
      var N = p.length
      for (A = 0; A < N; ++A) {
        var b = p[A]
        if (!b) {
          continue
        }
        if (b === i) {
          continue
        }
        var x = b.className
        if (n.test(x)) {
          continue
        }
        var C = b.closest('a')
        if (C) {
          var D = C.host === l.host
          var I = C.pathname === l.pathname
          if (!D || !I) {
            continue
          }
        }
        var M
        var L = false
        if (elementIsAHeader(b)) {
          if (isNaN(o)) {
            L = true
          } else if (e(b) - 1 === o) {
            L = true
          }
        }
        if (!L && SubheadRegex.test(x)) {
          L = true
        }
        if (!L) {
          const e = b.getAttribute('itemprop')
          if (/\bdescription\b/.test(e) && !/\barticleBody\b/.test(e)) {
            L = true
          }
        }
        if (!L && c.has(b.innerText)) {
          L = true
        }
        if (!L && h && h === b.innerText) {
          L = true
        }
        if (!(L || b.getAttribute('itemprop') !== 'summary')) {
          L = true
        }
        if (!L) {
          continue
        }
        if (normalizedElementTagName(b) === 'meta') {
          var w = b.getAttribute('content')
          M = w ? w.trim() : ''
          var R = b.nextElementSibling
          if (!R || trimmedInnerTextIgnoringTextTransform(R) !== M) {
            continue
          }
          b = R
        } else {
          if (cachedElementBoundingRect(b).top < (s.bottom + s.top) / 2) {
            continue
          }
          M = trimmedInnerTextIgnoringTextTransform(b).trim()
        }
        if (!M.length) {
          continue
        }
        this._articleSubheadElement = b
        const t = this.subheadUniqueID()
        this._mapOfUniqueIDToOriginalElement.set(t, b)
        this._weakMapOfOriginalElementToUniqueID.set(b, t)
        this._articleSubhead = M
        break
      }
      return this._articleSubhead
    }
    adoptableMetadataBlock() {
      function e(e) {
        function t(e, i) {
          if (e.nodeType !== Node.TEXT_NODE) {
            if (e.nodeType === Node.ELEMENT_NODE) {
              var r = e.childNodes
              var a = r.length
              if (a !== 0) {
                if (a !== 1) {
                  if (i !== 2) {
                    t(r[0], 1)
                  }
                  if (i !== 1) {
                    t(r[a - 1], 2)
                  }
                } else {
                  t(r[0], i)
                }
              }
            }
          } else if (i === 1) {
            e.textContent = e.textContent.trimLeft()
          } else if (i === 2) {
            e.textContent = e.textContent.trimRight()
          } else {
            e.textContent = e.textContent.trim()
          }
        }
        t(e)
      }
      this.updateArticleBylineAndDateElementsIfNecessary()
      var article = this.articleBylineElement()
      var articleDate = this.articleDateElement()
      if (!article && !articleDate) {
        return null
      }
      if (article && articleDate) {
        var i = article.compareDocumentPosition(articleDate)
        if (i & Node.DOCUMENT_POSITION_CONTAINS) {
          article = null
        }
        if (i & Node.DOCUMENT_POSITION_CONTAINED_BY) {
          articleDate = null
        }
        if (article === articleDate) {
          articleDate = null
        }
      }
      var r
      var a = this.contentDocument.createElement('div')
      var l = false
      var o = false
      if (article) {
        e((r = this.cleanArticleNode(article, article.cloneNode(true), 1, false)))
        if (r.innerText.trim()) {
          l = true
          r.classList.add('byline')
        }
      }
      if (articleDate) {
        var s = this.cleanArticleNode(articleDate, articleDate.cloneNode(true), 1, false)
        e(s)
        if (s.innerText.trim()) {
          o = true
          s.classList.add('date')
        }
      }
      if (l) {
        a.appendChild(r)
      }
      if (l && o) {
        var c = document.createElement('span')
        c.classList.add('delimiter')
        a.appendChild(c)
      }
      if (o) {
        a.appendChild(s)
      }
      return a
    }
    articleBylineElement() {
      return this._articleBylineElement
    }
    findArticleBylineElement() {
      var e = this.findArticleBylineElementWithoutRejection()
      if (
        e &&
        (normalizedElementTagName(e) === 'footer' || e.closest('figure'))
      ) {
        return null
      } else {
        return e
      }
    }
    findArticleBylineElementWithoutRejection() {
      function e(e) {
        if (!e.length) {
          return null
        }
        e = e.filter(isElementVisible)
        for (
          var t = new Set(), n = new Set(), r = e.length, o = 0;
          o < r - 1;
          ++o
        ) {
          var s = e[o]
          var c = e[o + 1]
          if (isElementVisible(s) && isElementVisible(c)) {
            var m = s.parentElement
            if (m === c.parentElement) {
              if (!m.contains(i)) {
                n.add(s.parentElement)
                t.add(s)
                t.add(c)
              }
            }
          }
        }
        var d = new Set(e)
        n.forEach(function (e) {
          d.add(e)
        })
        t.forEach(function (e) {
          d.delete(e)
        })
        e = []
        d.forEach(function (t) {
          e.push(t)
        })
        var h
        var u = null
        r = e.length
        for (o = 0; o < r; ++o) {
          s = e[o]
          if (isElementVisible(s)) {
            var f = cachedElementBoundingRect(s)
            var g = f.left + f.width / 2
            var p = f.top + f.height / 2
            var E = a - g
            var v = l - p
            var T = Math.sqrt(E * E + v * v)
            if (!u || T < h) {
              u = s
              h = T
            }
          }
        }
        return u
      }
      const t = "[itemprop~=author], a[rel='author']:not(svg a)"
      const n =
        "#byline, .byline, .article-byline, .byline__author, .entry-meta, .author-name, .byline-dateline, .article-author, [itemprop~=author], a[rel='author']:not(svg a)"
      var i = this._articleSubheadElement || this._articleTitleElement
      if (i) {
        var r
        var a = (r = i ? cachedElementBoundingRect(i) : null).left + r.width / 2
        var l = r.top + r.height / 2
      }
      var o = this.contentFromUniqueMetadataSelector(
        this.contentDocument,
        'head meta[name=author]',
      )
      if (!o) {
        o = this.contentFromUniqueMetadataSelector(
          this.contentDocument,
          'head meta[property=author]',
        )
      }
      if (!o) {
        var s = this.schemaDotOrgMetadataObjectForArticle()
        if (s) {
          var c = s.author
          if (c && typeof c == 'object') {
            o = c.name
          }
        }
      }
      var m = this.article.element
      var d = m.querySelectorAll(n)
      if (d.length === 1) {
        return d[0]
      }
      var h = i ? i.nextElementSibling : null
      if (h) {
        if (!(h.matches(n) || h.innerText === o)) {
          h = h.querySelector(n)
        }
        if (h) {
          if (h.querySelector('li')) {
            var u = h.querySelector(n)
            if (u) {
              h = u
            }
          }
        }
        if (h) {
          return h
        }
      }
      for (
        var f = this.contentDocument.getElementsByTagName('a'),
        g = 0,
        p = f.length;
        g < p;
        ++g
      ) {
        var E = f[g]
        if (trimmedInnerTextIgnoringTextTransform(E) === o) {
          return E
        }
      }
      var v = m.closest('article')
      if (i && v) {
        if ((y = e(Array.from(v.querySelectorAll(t))))) {
          return y
        }
        if ((y = e(Array.from(v.querySelectorAll(n))))) {
          return y
        }
      }
      var T = m.previousElementSibling
      if (T) {
        var y
        if ((y = e(Array.from(T.querySelectorAll(t))))) {
          return y
        }
        if ((y = e(Array.from(T.querySelectorAll(n))))) {
          return y
        }
      }
      return null
    }
    articleDateElement() {
      return this._articleDateElement
    }
    findArticleDateElement() {
      function e(e) {
        for (var t = e; t && t !== l; t = t.parentElement) {
          if (elementIsCommentBlock(t) || elementLooksLikeACarousel(t)) {
            return true
          }
        }
        return false
      }
      function t(t) {
        for (var n, i = null, r = t.length, a = 0; a < r; ++a) {
          var l = t[a]
          if (isElementVisible(l) && !e(l)) {
            var o = cachedElementBoundingRect(l)
            var s = o.left + o.width / 2
            var d = o.top + o.height / 2
            var h = c - s
            var u = m - d
            var f = Math.sqrt(h * h + u * u)
            if (!i || f < n) {
              i = l
              n = f
            }
          }
        }
        return i
      }
      const n = /date/i
      const i = 'time, .dateline, .entry-date'
      var r
      var a = this._articleSubheadElement || this._articleTitleElement
      var l = this.article.element
      var o = a ? a.nextElementSibling : null
      if (o && (r = o.querySelectorAll(i)).length === 1) {
        o = r[0]
      }
      if (
        !(
          !o ||
          o.matches(i) ||
          hasClassMatchingRegexp(o, n) ||
          o.querySelector(i)
        )
      ) {
        o = null
      }
      if (o && o.contains(l)) {
        o = null
      }
      if (o) {
        return o
      }
      if (a) {
        var s
        var c = (s = a ? cachedElementBoundingRect(a) : null).left + s.width / 2
        var m = s.top + s.height / 2
      }
      if ((r = l.querySelectorAll(i)).length) {
        return t(r)
      }
      if ((l = l.closest('article')) && (r = l.querySelectorAll(i)).length) {
        return t(r)
      }
      return null
    }
    articleDateElementWithBylineElementHint(e) {
      function t(e) {
        return (
          /date/.test(e.className) ||
          /\bdatePublished\b/.test(e.getAttribute('itemprop'))
        )
      }
      var n = e.nextElementSibling
      if (n && t(n)) {
        return n
      }
      var i = nextLeafElementForElement(e)
      if (i && t(i)) {
        return i
      } else {
        return null
      }
    }
    updateArticleBylineAndDateElementsIfNecessary() {
      if (this.article) {
        if (!this._didArticleBylineAndDateElementDetection) {
          this.updateArticleBylineAndDateElements()
          this._didArticleBylineAndDateElementDetection = true
        }
      }
    }
    updateArticleBylineAndDateElements() {
      var e = this.findArticleBylineElement()
      var t = this.findArticleDateElement()
      if (!t && e) {
        t = this.articleDateElementWithBylineElementHint(e)
      }
      this._articleDateElement = t
      this._articleBylineElement = e
    }
    articleIsLTR() {
      if (!this._articleIsLTR) {
        var e = getComputedStyle(this.article.element)
        this._articleIsLTR = !e || e.direction === 'ltr'
      }
      return this._articleIsLTR
    }
    findSuggestedCandidate() {
      var e
      var t
      var n = this.suggestedRouteToArticle
      if (!n || !n.length) {
        return null
      }
      for (
        t = n.length - 1;
        t >= 0 &&
        (!n[t].id || !(e = this.contentDocument.getElementById(n[t].id)));
        --t
      );
      t++
      if (!e) {
        e = this.contentDocument
      }
      for (; t < n.length;) {
        for (
          var i = n[t],
          r =
            e.nodeType === Node.DOCUMENT_NODE
              ? e.documentElement
              : e.firstElementChild,
          a = 1;
          r && a < i.index;
          r = r.nextElementSibling
        ) {
          if (!this.shouldIgnoreInRouteComputation(r)) {
            a++
          }
        }
        if (!r) {
          return null
        }
        if (normalizedElementTagName(r) !== normalizedElementTagName(i)) {
          return null
        }
        if (i.className && r.className !== i.className) {
          return null
        }
        e = r
        t++
      }
      if (isElementVisible(e)) {
        return new CandidateElement(e, this.contentDocument)
      } else {
        return null
      }
    }
    findArticleBySearchingAllElements(someFlag) {
      var t = this.findSuggestedCandidate()
      var n = this.findCandidateElements()
      if (!n || !n.length) {
        return t
      }
      if (t && t.basicScore() >= ReaderMinimumScore) {
        return t
      }
      for (
        var i = this.highestScoringCandidateFromCandidates(n), r = i.element;
        r !== this.contentDocument;
        r = r.parentNode
      ) {
        if (normalizedElementTagName(r) === 'blockquote') {
          for (var a = r.parentNode, l = n.length, o = 0; o < l; ++o) {
            var s = n[o]
            if (s.element === a) {
              i = s
              break
            }
          }
          break
        }
      }
      if (t && i.finalScore() < ReaderMinimumScore) {
        return t
      }
      if (!someFlag) {
        if (i.shouldDisqualifyDueToScoreDensity()) {
          return null
        }
        if (i.shouldDisqualifyDueToHorizontalRuleDensity()) {
          return null
        }
        if (i.shouldDisqualifyDueToHeaderDensity()) {
          return null
        }
        if (i.shouldDisqualifyDueToSimilarElements(n)) {
          return null
        }
      }
      return i
    }
    findExtraArticle() {
      if (!this.article) {
        return null
      }
      for (
        var e = 0, t = this.article.element;
        e < 3 && t;
        ++e, t = t.parentNode
      ) {
        var n = this.findExtraArticleCandidateElements(t)
        if (n && n.length) {
          for (
            var i, r = this.sortCandidateElementsInDescendingScoreOrder(n), a = 0;
            a < r.length && (i = r[a]) && i.basicScore();
            a++
          ) {
            if (
              !i.shouldDisqualifyDueToScoreDensity() &&
              !i.shouldDisqualifyDueToHorizontalRuleDensity() &&
              !(
                i.shouldDisqualifyDueToHeaderDensity() ||
                (cachedElementBoundingRect(i.element).height <
                  PrependedArticleCandidateMinimumHeight &&
                  cachedElementBoundingRect(this.article.element).width !==
                  cachedElementBoundingRect(i.element).width)
              )
            ) {
              var l = contentTextStyleForNode(this.contentDocument, i.element)
              if (
                l &&
                l.fontFamily === this.contentTextStyle().fontFamily &&
                l.fontSize === this.contentTextStyle().fontSize &&
                i
              ) {
                return i
              }
            }
          }
        }
      }
      return null
    }
    highestScoringCandidateFromCandidates(e) {
      for (var t = 0, n = null, i = e.length, r = 0; r < i; ++r) {
        var a = e[r]
        var l = a.basicScore()
        if (l >= t) {
          t = l
          n = a
        }
      }
      return n
    }
    sortCandidateElementsInDescendingScoreOrder(e) {
      function t(e, t) {
        if (e.basicScore() !== t.basicScore()) {
          return t.basicScore() - e.basicScore()
        } else {
          return t.depth() - e.depth()
        }
      }
      return e.sort(t)
    }
    findCandidateElements() {
      const e = 1000
      for (
        var t = Date.now() + e,
        n = this.contentDocument.getElementsByTagName('*'),
        i = n.length,
        r = [],
        a = 0;
        a < i;
        ++a
      ) {
        var l = n[a]
        if (!SetOfCandidateTagNamesToIgnore.has(normalizedElementTagName(l))) {
          var o = CandidateElement.candidateIfElementIsViable(
            l,
            this.contentDocument,
          )
          if (o) {
            r.push(o)
          }
          if (Date.now() > t) {
            r = []
            break
          }
        }
      }
      var s = r.length
      for (a = 0; a < s; ++a) {
        r[a].element.candidateElement = r[a]
      }
      for (a = 0; a < s; ++a) {
        var c = r[a]
        if (normalizedElementTagName(c.element) === 'blockquote') {
          var m = c.element.parentElement.candidateElement
          if (m) {
            m.addTextNodesFromCandidateElement(c)
          }
        }
      }
      for (a = 0; a < s; ++a) {
        r[a].element.candidateElement = null
      }
      return r
    }
    findExtraArticleCandidateElements(e) {
      if (!this.article) {
        return []
      }
      if (!e) {
        e = this.article.element
      }
      for (
        var t = 'preceding-sibling::*/descendant-or-self::*',
        n = this.contentDocument.evaluate(
          t,
          e,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null,
        ),
        i = n.snapshotLength,
        r = [],
        a = 0;
        a < i;
        ++a
      ) {
        var l = n.snapshotItem(a)
        if (!SetOfCandidateTagNamesToIgnore.has(normalizedElementTagName(l))) {
          if (
            (o = CandidateElement.extraArticleCandidateIfElementIsViable(
              l,
              this.article,
              this.contentDocument,
              true,
            ))
          ) {
            r.push(o)
          }
        }
      }
      t = 'following-sibling::*/descendant-or-self::*'
      i = (n = this.contentDocument.evaluate(
        t,
        e,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      )).snapshotLength
      for (a = 0; a < i; ++a) {
        var o
        l = n.snapshotItem(a)
        if (!SetOfCandidateTagNamesToIgnore.has(normalizedElementTagName(l))) {
          if (
            (o = CandidateElement.extraArticleCandidateIfElementIsViable(
              l,
              this.article,
              this.contentDocument,
              false,
            ))
          ) {
            r.push(o)
          }
        }
      }
      return r
    }
    isGeneratedBy(e) {
      var t = this.contentDocument.head
        ? this.contentDocument.head.querySelector('meta[name=generator]')
        : null
      if (!t) {
        return false
      }
      var n = t.content
      return !!n && e.test(n)
    }
    isMediaWikiPage() {
      if (this._isMediaWikiPage === undefined) {
        this._isMediaWikiPage = this.isGeneratedBy(/^MediaWiki /)
      }
      return this._isMediaWikiPage
    }
    isWordPressSite() {
      return this.isGeneratedBy(/^WordPress/)
    }
    isAMPPage() {
      return this.contentDocument.documentElement.hasAttribute('amp-version')
    }
    nextPageURLString() {
      if (!this.article) {
        return null
      }
      if (this.isMediaWikiPage()) {
        return null
      }
      var e
      var t = 0
      var n = this.article.element
      if (n.parentNode && getComputedStyle(n).display === 'inline') {
        n = n.parentNode
      }
      for (
        var i = n,
        r =
          cachedElementBoundingRect(n).bottom +
          LinkMaxVerticalDistanceFromArticle;
        isElementNode(i) && cachedElementBoundingRect(i).bottom <= r;

      ) {
        i = i.parentNode
      }
      if (!(i === n || (i !== this.contentDocument && !isElementNode(i)))) {
        n = i
      }
      var a = this.contentDocument.evaluate(
        LinkCandidateXPathQuery,
        n,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      )
      var l = a.snapshotLength
      if (this.pageNumber <= 2 && !this.prefixWithDateForNextPageURL) {
        var o = this.contentDocument.location.pathname
        var s = o.match(LinkDateRegex)
        if (s) {
          s = s[0]
          this.prefixWithDateForNextPageURL = o.substring(
            0,
            o.indexOf(s) + s.length,
          )
        }
      }
      for (var c = 0; c < l; ++c) {
        var m = a.snapshotItem(c)
        var d = this.scoreNextPageLinkCandidate(m)
        if (d > t) {
          e = m
          t = d
        }
      }
      if (e) {
        return e.href
      } else {
        return null
      }
    }
    scoreNextPageLinkCandidate(e) {
      function t(e, t, n, i) {
        if (t.substring(0, e.length) === e) {
          t = t.substring(e.length)
          e = ''
        }
        var r = t.lastInteger()
        if (isNaN(r)) {
          return false
        }
        var a = e ? e.lastInteger() : NaN
        if (isNaN(a) || a >= MaximumExactIntegralValue) {
          a = i
        }
        if (r === a) {
          return n.lastInteger() === a + 1
        } else {
          return r === a + 1
        }
      }
      function n(e) {
        for (
          var t = {}, n = e.substring(1).split('&'), i = n.length, r = 0;
          r < i;
          ++r
        ) {
          var a = n[r]
          var l = a.indexOf('=')
          if (l === -1) {
            t[a] = null
          } else {
            t[a.substring(0, l)] = a.substring(l + 1)
          }
        }
        return t
      }
      var i = this.contentDocument.location
      if (e.host !== i.host) {
        return 0
      }
      if (e.pathname === i.pathname && e.search === i.search) {
        return 0
      }
      if (e.toString().indexOf('#') !== -1) {
        return 0
      }
      if (anchorLinksToAttachment(e) || anchorLinksToTagOrCategoryPage(e)) {
        return 0
      }
      if (!isElementVisible(e)) {
        return 0
      }
      var r = cachedElementBoundingRect(e)
      var a = this.articleBoundingRect()
      var l = Math.max(
        0,
        Math.max(a.top - (r.top + r.height), r.top - (a.top + a.height)),
      )
      if (r.top < a.top) {
        return 0
      }
      if (l > LinkMaxVerticalDistanceFromArticle) {
        return 0
      }
      if (
        Math.max(
          0,
          Math.max(a.left - (r.left + r.width), r.left - (a.left + a.width)),
        ) > 0
      ) {
        return 0
      }
      var o = i.pathname
      var s = e.pathname
      if (this.prefixWithDateForNextPageURL) {
        if (e.pathname.indexOf(this.prefixWithDateForNextPageURL) === -1) {
          return 0
        }
        o = o.substring(this.prefixWithDateForNextPageURL.length)
        s = s.substring(this.prefixWithDateForNextPageURL.length)
      }
      var c = s.substring(1).split('/')
      if (!c[c.length - 1]) {
        c.pop()
      }
      var m = c.length
      var d = o.substring(1).split('/')
      var h = false
      if (!d[d.length - 1]) {
        h = true
        d.pop()
      }
      var u = d.length
      if (m < u) {
        return 0
      }
      for (var f = 0, g = 0, p = e.textContent, E = 0; E < m; ++E) {
        var v = c[E]
        var T = E < u ? d[E] : ''
        if (T !== v) {
          if (E < u - 2) {
            return 0
          }
          if (v.length >= T.length) {
            for (var y = 0; v[v.length - 1 - y] === T[T.length - 1 - y];) {
              y++
            }
            if (y) {
              v = v.substring(0, v.length - y)
              T = T.substring(0, T.length - y)
            }
            var A = v.indexOf(T)
            if (A !== -1) {
              v = v.substring(A)
            }
          }
          if (t(T, v, p, this.pageNumber)) {
            g = Math.pow(LinkNextOrdinalValueBase, E - m + 1)
          } else {
            f++
          }
        }
        if (f > 1) {
          return 0
        }
      }
      var S = false
      if (e.search) {
        linkParameters = n(e.search)
        referenceParameters = n(i.search)
        for (var N in linkParameters) {
          var b = linkParameters[N]
          var x = N in referenceParameters ? referenceParameters[N] : null
          if (x !== b) {
            if (x === null) {
              x = ''
            }
            if (b === null) {
              b = ''
            }
            if (b.length < x.length) {
              f++
            } else if (t(x, b, p, this.pageNumber)) {
              if (LinkURLSearchParameterKeyMatchRegex.test(N)) {
                if (o.toLowerCase() !== s.toLowerCase()) {
                  return 0
                }
                if (this.isWordPressSite() && h) {
                  return 0
                }
                S = true
              }
              if (LinkURLBadSearchParameterKeyMatchRegex.test(N)) {
                f++
                continue
              }
              g = Math.max(g, 1 / LinkNextOrdinalValueBase)
            } else {
              f++
            }
          }
        }
      }
      if (!g) {
        return 0
      }
      if (
        LinkURLPageSlashNumberMatchRegex.test(e.href) ||
        LinkURLSlashDigitEndMatchRegex.test(e.href)
      ) {
        S = true
      }
      if (
        !S &&
        m === u &&
        stringSimilarity(o, s) < LinkMinimumURLSimilarityRatio
      ) {
        return 0
      }
      if (LinkURLArchiveSlashDigitEndMatchRegex.test(e)) {
        return 0
      }
      var C =
        LinkMatchWeight * (Math.pow(LinkMismatchValueBase, -f) + g) +
        (LinkVerticalDistanceFromArticleWeight * l) /
        LinkMaxVerticalDistanceFromArticle
      if (S) {
        C += LinkURLSemanticMatchBonus
      }
      if (normalizedElementTagName(e.parentNode) === 'li') {
        C += LinkListItemBonus
      }
      p = e.innerText
      if (LinkNextMatchRegEx.test(p)) {
        C += LinkNextMatchBonus
      }
      if (LinkPageMatchRegEx.test(p)) {
        C += LinkPageMatchBonus
      }
      if (LinkContinueMatchRegEx.test(p)) {
        C += LinkContinueMatchBonus
      }
      return C
    }
    elementContainsEnoughTextOfSameStyle(e, t, n) {
      const i = 110
      var r = normalizedElementTagName(e) === 'body'
      var a = getVisibleNonWhitespaceTextNodes(e, r ? 2 : 3, i, r, t)
      const l = 0.2
      const o =
        n /
        clamp(scoreMultiplierForElementTagNameAndAttributes(e), l, Infinity) /
        languageScoreMultiplierForTextNodes(a)
      for (var s = {}, c = a.length, m = 0; m < c; ++m) {
        var d = a[m]
        var h = d.length
        var u = d.parentElement
        var f = window.getComputedStyle(u)
        var g = f.fontFamily + '|' + f.fontSize
        var p = Math.pow(h, TextNodeLengthPower)
        if (s[g]) {
          if ((s[g] += p) > o) {
            break
          }
        } else {
          s[g] = p
        }
      }
      for (var g in s) {
        if (s[g] > o) {
          return true
        }
      }
      return false
    }
    openGraphMetadataClaimsPageTypeIsArticle() {
      if (!this._openGraphMetadataClaimsPageTypeIsArticle) {
        var e = this.contentDocument.querySelector(
          "head meta[property='og:type']",
        )
        this._openGraphMetadataClaimsPageTypeIsArticle =
          e && e.content === 'article'
      }
      return this._openGraphMetadataClaimsPageTypeIsArticle
    }
    prismGenreClaimsPageIsHomepage() {
      return (
        this.contentFromUniqueMetadataSelector(
          this.contentDocument,
          "head meta[name='prism.genre']",
        ) === 'homePage'
      )
    }
    pointsToUseForHitTesting() {
      const e = window.innerWidth
      const t = e / 4
      const n = e / 2
      const i = 128
      const r = 320
      var a = [
        [n, 800],
        [n, 600],
        [t, 800],
        [n, 400],
        [n - i, 1100],
        [r, 700],
        [t * 3, 800],
        [e - r, 700],
      ]
      if (this.openGraphMetadataClaimsPageTypeIsArticle()) {
        a.push([n - i, 1400])
      }
      return a
    }
    findArticleByVisualExamination() {
      for (
        var e = new Set(),
        t = this.pointsToUseForHitTesting(),
        n = t.length,
        i = AppleDotComAndSubdomainsRegex.test(
          this.contentDocument.location.hostname.toLowerCase(),
        )
          ? 7200
          : 1800,
        r = this.candidateElementFilter,
        a = 0;
        a < n;
        a++
      ) {
        for (
          var l = t[a][0],
          o = t[a][1],
          s = elementAtPoint(l, o, this.contentDocument);
          s && !e.has(s);
          s = s.parentElement
        ) {
          if (VeryPositiveClassNameRegEx.test(s.className)) {
            return new CandidateElement(s, this.contentDocument)
          }
          if (!SetOfCandidateTagNamesToIgnore.has(normalizedElementTagName(s))) {
            var c = s.offsetWidth
            var m = s.offsetHeight
            if (!c && !m) {
              var d = cachedElementBoundingRect(s)
              c = d.width
              m = d.height
            }
            if (
              !(
                c < r.minimumWidth ||
                m < r.minimumHeight ||
                c * m < r.minimumArea
              )
            ) {
              var h = this.elementContainsEnoughTextOfSameStyle(s, e, i)
              e.add(s)
              if (
                h &&
                !(
                  CandidateElement.candidateElementAdjustedHeight(s) <
                  r.minimumHeight
                )
              ) {
                var u = new CandidateElement(s, this.contentDocument)
                if (!u.shouldDisqualifyDueToSimilarElements()) {
                  if (u.shouldDisqualifyDueToHorizontalRuleDensity()) {
                    return null
                  }
                  if (u.shouldDisqualifyDueToHeaderDensity()) {
                    return null
                  }
                  if (!u.shouldDisqualifyForDeepLinking()) {
                    return u
                  }
                }
              }
            }
          }
        }
      }
      return null
    }
    findTextSamplesByVisualExamination() {
      function e(e) {
        if (!e || !e.innerText) {
          return null
        }
        let n = t(e.innerText.trim())
        if (n) {
          a.add(e)
        }
        return n
      }
      function t(e) {
        const t = 10
        let i = textContentAppearsToBeCJK(e, d) ? d : m
        let r = e.length
        if (r < i) {
          return null
        }
        if (r > g * c) {
          return null
        }
        let a = n(e)
        if ((a.match(/\n/g) || []).length > t) {
          return null
        } else {
          return a
        }
      }
      function n(e) {
        return e.substring(0, h)
      }
      function i(t, n) {
        let i = []
        let r = s.querySelectorAll(t)
        for (let t of r) {
          if (i.length >= n) {
            break
          }
          if (elementDescendsFromElementInSet(t, l)) {
            continue
          }
          let r = e(t)
          if (r) {
            i.push([t, r])
          }
        }
        return i
      }
      function r(e) {
        const n = document.querySelectorAll('div')
        const i = new Set()
        for (let r of n) {
          if (r.firstElementChild) {
            continue
          }
          let n = t(r.textContent)
          if (n && (i.add(n), i.size >= e)) {
            break
          }
        }
        return i
      }
      var a = new Set()
      var l = new Set()
      var o = new Set()
      var s = this.contentDocument
      var c = s.body.innerText.length
      const m = 20
      const d = 10
      const h = 200
      const u = 5
      const f = 5
      const g = 0.8
      let p = s.title
      let E = t(p)
      if (E) {
        o.add(E)
        l.add(p)
      }
      let v = this.pointsToUseForHitTesting()
      let T = v.length
      for (var y = 0; y < T; y++) {
        let t = v[y][0]
        let n = v[y][1]
        let i = 0
        for (
          let r = elementAtPoint(t, n, this.contentDocument);
          r && !a.has(r) && !(i > u);
          r = r.parentElement, i++
        ) {
          let t = e(r)
          if (t) {
            if (elementDescendsFromElementMatchingSelector(r, 'code, form')) {
              break
            }
            o.add(t)
            l.add(r)
            break
          }
        }
      }
      let A = {
        p: 3,
        h1: 2,
        h2: 2,
        h3: 1,
      }
      for (let [e, t] of Object.entries(A)) {
        let n = i(e, t)
        for (let [e, t] of n) {
          if (e && t) {
            o.add(t)
            l.add(e)
          }
        }
      }
      if (o.size < f) {
        let e = ['article', 'header', 'a', 'footer', 'body']
        for (let t of e) {
          let e = i(t, 1) || []
          let [n, r] = e.length > 0 ? e[0] : [null, null]
          if (n && r) {
            o.add(r)
            l.add(n)
            break
          }
        }
      }
      if (o.size < f) {
        const e = r(f - o.size)
        o = o.union(e)
      }
      return Array.from(o)
    }
    findArticleFromMetadata(e) {
      var t = this.contentDocument.querySelectorAll(
        SchemaDotOrgArticleContainerSelector,
      )
      if (t.length === 1) {
        var n = t[0]
        if (n.matches('article, *[itemprop=articleBody]')) {
          if (
            (o = CandidateElement.candidateIfElementIsViable(
              n,
              this.contentDocument,
              true,
            ))
          ) {
            return e === FindArticleMode.ExistenceOfElement || o
          }
        }
        var i = n.querySelectorAll('article, *[itemprop=articleBody]')
        var r = elementWithLargestAreaFromElements(i)
        if (r) {
          if (
            (o = CandidateElement.candidateIfElementIsViable(
              r,
              this.contentDocument,
              true,
            ))
          ) {
            return e === FindArticleMode.ExistenceOfElement || o
          }
        }
        return new CandidateElement(n, this.contentDocument)
      }
      if (
        this.openGraphMetadataClaimsPageTypeIsArticle() &&
        !this.prismGenreClaimsPageIsHomepage()
      ) {
        var a = this.contentDocument.querySelectorAll('main article')
        var l = elementWithLargestAreaFromElements(a)
        if (l) {
          if (
            (o = CandidateElement.candidateIfElementIsViable(
              l,
              this.contentDocument,
              true,
            ))
          ) {
            return e === FindArticleMode.ExistenceOfElement || o
          }
        }
        var o
        var s = this.contentDocument.querySelectorAll('article')
        if (s.length === 1) {
          if (
            (o = CandidateElement.candidateIfElementIsViable(
              s[0],
              this.contentDocument,
              true,
            ))
          ) {
            return e === FindArticleMode.ExistenceOfElement || o
          }
        }
      }
      return null
    }
    articleTextContent() {
      if (!this._articleTextContent) {
        this.adoptableArticle()
      }
      return this._articleTextContent
    }
    unformattedArticleTextContentIncludingMetadata(e) {
      var t = this.articleNode()
      if (t) {
        if (!e) {
          return t.innerText
        }
        var n = ''
        var i = this.articleTitle()
        if (i) {
          n += i + '\n'
        }
        var r = this.articleSubhead()
        if (r) {
          n += r + '\n'
        }
        var a = this.adoptableMetadataBlock()
        if (a) {
          n +=
            this.plaintextVersionOfNodeAppendingNewlinesBetweenBlockElements(a) +
            '\n'
        }
        return n + t.innerText
      }
    }
    plaintextVersionOfNodeAppendingNewlinesBetweenBlockElements(e) {
      var t = this.contentDocument.createTreeWalker(
        e,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        null,
      )
      var n = ''
      for (t.currentNode = e; t.nextNode();) {
        var i = t.currentNode
        if (i.nodeType !== Node.TEXT_NODE) {
          var r = normalizedElementTagName(i)
          if (!(r !== 'p' && r !== 'div')) {
            n += '\n'
          }
        } else {
          n += i.textContent
        }
      }
      return n
    }
    pageDescription() {
      for (
        var e = this.contentDocument.querySelectorAll('head meta[name]'),
        t = e.length,
        n = 0;
        n < t;
        ++n
      ) {
        var i = e[n]
        if (i.getAttribute('name').toLowerCase() === 'description') {
          var r = i.getAttribute('content')
          if (r) {
            return r.trim()
          }
        }
      }
      return null
    }
    articleTitleAndSiteNameFromTitleString(e) {
      const t = [' - ', ' – ', ' — ', ': ', ' | ', ' » ']
      const n = t.length
      const i = 0.6
      for (
        var r,
        a,
        l = this.contentDocument.location.host.replace(/^(www|m|secure)\./, ''),
        o = l.replace(/\.(com|info|net|org|edu|gov)$/, '').toLowerCase(),
        s = 0;
        s < n;
        ++s
      ) {
        var c = e.split(t[s])
        if (c.length === 2) {
          var m = c[0].trim()
          var d = c[1].trim()
          var h = m.toLowerCase()
          var u = d.toLowerCase()
          var f = Math.max(stringSimilarity(h, l), stringSimilarity(h, o))
          var g = Math.max(stringSimilarity(u, l), stringSimilarity(u, o))
          var p = Math.max(f, g)
          if (!a || p > a) {
            a = p
            r =
              f > g
                ? {
                  siteName: m,
                  articleTitle: d,
                }
                : {
                  siteName: d,
                  articleTitle: m,
                }
          }
        }
      }
      if (r && a >= i) {
        return r
      } else {
        return null
      }
    }
    pageInformation(e, t) {
      var n
      var i = this.pageDescription()
      var r = false
      if (this.adoptableArticle()) {
        n = this.articleTitle()
        i = i || this.articleTextContent()
        r = true
      } else {
        n = this.contentDocument.title
        if (this.contentDocument.body) {
          i = i || this.contentDocument.body.innerText
        }
      }
      var a = ''
      var l = this.buildMapOfMetaTags()
      var o = this.pageImageURLFromMetadata(l)
      if (o) {
        a = o
      } else {
        var s = this.mainImageNode()
        if (s) {
          a = s.src
        }
      }
      if (!n) {
        n = userVisibleURLString(this.contentDocument.location.href)
      }
      n = n.trim()
      if (e) {
        n = n.substring(0, e)
      }
      var c = this.contentFromUniqueMetadataSelector(
        this.contentDocument,
        "head meta[property='og:site_name']",
      )
      if (!c) {
        var m = this.articleTitleAndSiteNameFromTitleString(
          this.contentDocument.title,
        )
        if (m && m.articleTitle === n) {
          c = m.siteName
        }
      }
      if (!c) {
        c = ''
      }
      i = i ? i.trim() : ''
      if (t) {
        i = i.substring(0, t)
      }
      return {
        title: n,
        previewText: (i = i.replace(/[\s]+/g, ' ')),
        siteName: c,
        mainImageURL: a,
        isReaderAvailable: r,
      }
    }
    readingListItemInformation() {
      const e = 220
      const t = 220
      return this.pageInformation(e, t)
    }
    buildMapOfMetaTags() {
      var e = {}
      const t = this.contentDocument.head.getElementsByTagName('meta')
      const n = t.length
      for (var i = 0; i < n; ++i) {
        const n = t[i]
        const r = n.content
        if (!r) {
          continue
        }
        if (this.elementAttributesContainImproperQuote(n)) {
          continue
        }
        if (n.name) {
          e['name:' + n.name.toLowerCase()] = r
        }
        const a = n.getAttribute('property')
        if (a) {
          e['property:' + a.toLowerCase()] = r
        }
      }
      return e
    }
    longestPageMetadataDescriptionForTextAnalysis(e) {
      var t = []
      const n = e['name:description']
      if (n && n.length) {
        t.push(n)
      }
      const i = e['property:og:description']
      if (i && i.length) {
        t.push(i)
      }
      const r = e['name:twitter:description']
      if (r && r.length) {
        t.push(r)
      }
      if (t.length) {
        return t.reduce(function (e, t) {
          if (e.length > t.length) {
            return e
          } else {
            return t
          }
        })
      } else {
        return null
      }
    }
    pageTypeForTextAnalysis(e) {
      const t = this.contentDocument.documentElement.getAttribute('itemtype')
      if (
        t === 'http://schema.org/SearchResultsPage' ||
        t === 'https://schema.org/SearchResultsPage'
      ) {
        return 'search-results'
      }
      const n = e['name:section']
      if (n && n.toLowerCase() === 'homepage') {
        return 'homepage'
      }
      const i = e['property:og:type']
      if (i) {
        const e = i.toLowerCase()
        if (e === 'homepage') {
          return 'homepage'
        }
        if (e === 'article') {
          return 'article'
        }
      }
      const r = e['property:analytics-s-channel']
      if (r && r.toLowerCase() === 'homepage') {
        return 'homepage'
      } else {
        return null
      }
    }
    pageTitleForTextAnalysis(e) {
      const t = this.contentDocument
      var n = e['property:og:title']
      if (!n) {
        n = e['name:twitter:title']
      }
      if (!n) {
        n = e['name:sailthru.headline']
      }
      if (!n) {
        n = t.title
      }
      return n
    }
    pageKeywordsForTextAnalysis(e) {
      return e['name:keywords']
    }
    pageAuthorForTextAnalysis(e) {
      return e['name:author'] || e['property:author']
    }
    pageMetadataCommonToTextAnalysisAndArticleContent() {
      var e = {}
      const t = this.buildMapOfMetaTags()
      const n = this.pageTitleForTextAnalysis(t)
      if (n) {
        e.title = n
      }
      const i = this.pageAuthorForTextAnalysis(t)
      if (i) {
        e.author = i
      }
      const r = this.pageImageURLFromMetadata(t)
      if (r) {
        e.imageURL = r
      }
      return e
    }
    pageMetadataForTextAnalysis() {
      let e = this.pageMetadataCommonToTextAnalysisAndArticleContent()
      const t = this.pageTypeForTextAnalysis(metadataMap)
      if (t) {
        e.type = t
      }
      const n = this.longestPageMetadataDescriptionForTextAnalysis(metadataMap)
      if (n) {
        e.description = n
      }
      const i = this.pageKeywordsForTextAnalysis(metadataMap)
      if (i) {
        e.keywords = i
      }
      return e
    }
    extractedArticleContent(extraProcessor) {
      try {
        let time = Date.now()
        let article = this.adoptableArticle(true)
        if (!article) {
          throw new Error('ReaderArticleFinderJS: No article found')
        }
        console.log('ReaderArticleFinderJS: Time to adopt article', Date.now() - time)
        time = Date.now()
        const t = this.elementReaderUniqueIDAttributeKey()
        for (let n of article.getElementsByTagName('*')) {
          n.removeAttribute(t)
        }
        console.log('ReaderArticleFinderJS: Time to extract article content', Date.now() - time)
        time = Date.now()
        let data = this.pageMetadataCommonToTextAnalysisAndArticleContent()
        if (article) {
          if (extraProcessor) {
            article = extraProcessor(article)
          }
          data.body = article.innerHTML
        }
        console.log('ReaderArticleFinderJS: Time to extract article metadata', Date.now() - time)
        time = Date.now()
        this.updateArticleBylineAndDateElementsIfNecessary()
        const i = this.articleDateElement()
        if (i) {
          data.publishedDate = trimmedInnerTextIgnoringTextTransform(i)
        }
        console.log('ReaderArticleFinderJS: Time to extract article date', Date.now() - time)
        time = Date.now()
        const r = this.articleBylineElement()
        if (!data.author && r) {
          data.author = trimmedInnerTextIgnoringTextTransform(r)
        }
        console.log('ReaderArticleFinderJS: Time to extract article author', Date.now() - time)
        return data
      } catch (e) {
        console.error(e)
        let res = {}
        const msg = e.message
        const stack = e.stack
        if (msg) {
          res.error = msg
        }
        if (stack) {
          res.stack = stack
        }
        return res
      }
    }
    readerUniqueIDOfElementPinnedToTopOfViewport() {
      const e = 120
      if (window.scrollY < e) {
        return null
      }
      const t = this.articleNode()
      if (!t) {
        return null
      }
      const n = t.getBoundingClientRect()
      const i = (n.left + n.right) / 2
      for (const e of [0, 15, 35, 50, 80, 110]) {
        const n = t.ownerDocument.elementFromPoint(i, e)
        if (
          n !== t &&
          (t.contains(n) ||
            n === this._articleTitleElement ||
            n === this._articleSubheadElement)
        ) {
          const e = this._weakMapOfOriginalElementToUniqueID.get(n)
          if (e) {
            return e
          }
        }
      }
      return null
    }
    elementReaderUniqueIDAttributeKey() {
      return 'data-reader-unique-id'
    }
    titleUniqueID() {
      return 'titleElement'
    }
    subheadUniqueID() {
      return 'subheadElement'
    }
    rectOfElementWithReaderUniqueID(e) {
      function t(e) {
        return {
          top: e.top + window.scrollY,
          right: e.right + window.scrollX,
          bottom: e.bottom + window.scrollY,
          left: e.left + window.scrollX,
          width: e.width,
          height: e.height,
        }
      }
      if (!this._mapOfUniqueIDToOriginalElement) {
        return null
      }
      let n = this._mapOfUniqueIDToOriginalElement.get(e)
      if (n && n.parentElement) {
        return t(n.getBoundingClientRect())
      } else {
        return null
      }
    }
    scrollY() {
      return window.scrollY
    }
    scrollToOffset(e) {
      if (typeof e == 'number') {
        try {
          clearCachedElementBoundingRects()
          this.cacheWindowScrollPosition()
          this.contentDocument.scrollingElement.scrollTop = e
        } catch (e) { }
      }
    }
    documentURLString() {
      return this.contentDocument.location.href
    }
    usesSearchEngineOptimizationMetadata() {
      return !!document.head.querySelector('meta[property^="og:"]')
    }
    extractCanonicalLink() {
      var e = document.head.querySelector("link[rel='canonical']")
      if (!e) {
        return null
      }
      var t = e.getAttribute('href')
      if (!t) {
        return null
      }
      var n = document.baseURI
      var i = urlFromString(t, n)
      if (
        (document.location.pathname !== '/' && i.pathname === '/') ||
        (i.hostname === 'localhost' && document.location.hostname !== 'localhost')
      ) {
        return null
      } else {
        return i.href
      }
    }
  }

  var ReaderArticleFinderJS

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init()
    })
  } else {
    init()
  }

  function init() {
    ReaderArticleFinderJS = new ReaderArticleFinder(document)
    window.readerArticleFinderJS = ReaderArticleFinderJS
  }

})()