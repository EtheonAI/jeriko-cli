/**
 * 人机验证检测脚本 v4.0
 * 目标: 只检测真正阻断用户操作的人机验证,而非仅检测存在性
 */
(() => {
    const detectionInfo = {
        detected: false,
        type: null,
        confidence: 0,
        indicators: []
    };

    function setDetectionInfo(type, confidence, indicator) {
        if (confidence > detectionInfo.confidence) {
            detectionInfo.detected = true;
            detectionInfo.type = type;
            detectionInfo.confidence = confidence;
            detectionInfo.indicators = [indicator];
        } else if (confidence === detectionInfo.confidence) {
            detectionInfo.detected = true;
            detectionInfo.indicators.push(indicator);
        } else if (detectionInfo.detected) {
            detectionInfo.indicators.push(indicator);
        }
    }

    /**
     * 增强版可见性检查
     */
    function isElementVisible(element, minSize = 0) {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
            return false;
        }

        if (parseFloat(style.opacity) === 0) {
            return false;
        }

        // 尺寸过滤
        if (minSize > 0 && rect.width < minSize && rect.height < minSize) {
            return false;
        }

        // 检查是否在视口内
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
            return false;
        }
        if (rect.right < 0 || rect.left > window.innerWidth) {
            return false;
        }

        return true;
    }

    /**
     * 检查元素是否在页面中心区域(可能阻断主要内容)
     */
    function isInCenterRegion(element) {
        const rect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 检查是否在中心50%区域
        const centerX = viewportWidth / 2;
        const centerY = viewportHeight / 2;
        const elementCenterX = rect.left + rect.width / 2;
        const elementCenterY = rect.top + rect.height / 2;

        return Math.abs(elementCenterX - centerX) < viewportWidth * 0.25 &&
               Math.abs(elementCenterY - centerY) < viewportHeight * 0.25;
    }

    /**
     * 检查是否有遮罩层阻断页面
     */
    function hasBlockingOverlay() {
        const allElements = document.querySelectorAll('*');
        for (const element of allElements) {
            const style = window.getComputedStyle(element);
            const zIndex = parseInt(style.zIndex);

            // 检查高z-index的遮罩层
            if (zIndex > 1000 && style.position === 'fixed') {
                const rect = element.getBoundingClientRect();
                // 检查是否覆盖大部分视口
                if (rect.width > window.innerWidth * 0.8 &&
                    rect.height > window.innerHeight * 0.8) {
                    // 检查是否半透明或有背景色
                    if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
                        parseFloat(style.opacity) < 1) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // ==================== Cloudflare 检测 ====================

    // Cloudflare "Just a moment" 挑战页面
    if (document.title.toLowerCase().includes('just a moment')) {
        const bodyText = document.body.innerText.toLowerCase();
        if (bodyText.includes('verify you are human') ||
            bodyText.includes('checking your browser') ||
            (bodyText.includes('cloudflare') && bodyText.length < 1000)) {
            setDetectionInfo('cloudflare_challenge', 95, 'title: Just a moment + Cloudflare verification text');
        }
    }

    // Cloudflare 阻断页面
    const bodyText = document.body.innerText;
    if ((bodyText.includes('you have been blocked') || bodyText.includes('Access denied')) &&
        bodyText.includes('Cloudflare') && bodyText.includes('Ray ID')) {
        setDetectionInfo('cloudflare_block', 95, 'text: Cloudflare block page with Ray ID');
    }

    // Cloudflare 挑战表单
    const cfChallengeSelectors = ['#challenge-form', '#cf-challenge-running', '.cf-browser-verification'];
    for (const selector of cfChallengeSelectors) {
        const element = document.querySelector(selector);
        if (element && isElementVisible(element, 0)) {
            setDetectionInfo('cloudflare_challenge', 90, `selector: ${selector} (active challenge)`);
            break;
        }
    }

    // Cloudflare Turnstile (交互式验证)
    const turnstileElement = document.querySelector('.cf-turnstile[data-sitekey]');
    if (turnstileElement && isElementVisible(turnstileElement, 100)) {
        // 检查是否需要用户交互
        const iframe = turnstileElement.querySelector('iframe');
        if (iframe && isElementVisible(iframe, 100)) {
            setDetectionInfo('cloudflare_turnstile', 85, 'selector: .cf-turnstile with visible iframe (blocking)');
        }
    }

    // ==================== reCAPTCHA 检测 ====================

    // 1. 先检查明确的v2 checkbox元素
    const recaptchaCheckbox = document.querySelector('.recaptcha-checkbox, .recaptcha-checkbox-border');
    if (recaptchaCheckbox && isElementVisible(recaptchaCheckbox, 20)) {
        setDetectionInfo('recaptcha_v2', 90, 'selector: recaptcha checkbox (v2, blocking)');
    }

    // 2. 检查reCAPTCHA iframe - 精准判断是否为阻断型
    if (!detectionInfo.detected || detectionInfo.type !== 'recaptcha_v2') {
        const recaptchaIframes = document.querySelectorAll('iframe[src*="recaptcha"]');

        for (const iframe of recaptchaIframes) {
            if (!isElementVisible(iframe, 0)) continue;

            const rect = iframe.getBoundingClientRect();
            const src = iframe.src.toLowerCase();

            // v2 anchor frame (checkbox) - 通常 304x78px
            if (src.includes('/anchor') && rect.width > 250 && rect.height > 60) {
                setDetectionInfo('recaptcha_v2', 85, `iframe: recaptcha v2 anchor (${Math.round(rect.width)}x${Math.round(rect.height)}px, blocking)`);
                break;
            }

            // v2 bframe (图片挑战) - 通常 400x580px
            if (src.includes('/bframe') && rect.width > 350 && rect.height > 400) {
                setDetectionInfo('recaptcha_v2', 90, `iframe: recaptcha v2 bframe (${Math.round(rect.width)}x${Math.round(rect.height)}px, blocking)`);
                break;
            }

            // 通用大尺寸iframe检测(可能是挑战界面)
            if (rect.width > 300 && rect.height > 300 && isInCenterRegion(iframe)) {
                setDetectionInfo('recaptcha_v2', 75, `iframe: large recaptcha in center (${Math.round(rect.width)}x${Math.round(rect.height)}px, likely blocking)`);
                break;
            }

            // v3 badge - 明确排除(通常256x60px或更小,在右下角)
            if (rect.width < 300 && rect.height < 100) {
                // 这是v3 badge,不阻断用户,跳过
                continue;
            }
        }
    }

    // 3. 文本关键词检测 - 明确要求完成验证
    if (!detectionInfo.detected) {
        const pageText = document.body.innerText.toLowerCase();
        if ((pageText.includes('please complete the captcha') ||
             pageText.includes('complete the captcha above') ||
             pageText.includes('solve the captcha') ||
             pageText.includes('verify you are not a robot')) &&
            pageText.length < 3000) {  // 短页面更可能是验证页
            setDetectionInfo('recaptcha', 80, 'text: explicit captcha completion request');
        }
    }

    // ==================== hCaptcha 检测 ====================

    const hcaptchaSelectors = ['.h-captcha[data-sitekey]', '#hcaptcha'];
    for (const selector of hcaptchaSelectors) {
        const element = document.querySelector(selector);
        if (element && isElementVisible(element, 100)) {
            // 检查是否有iframe(表示需要交互)
            const iframe = element.querySelector('iframe');
            if (iframe && isElementVisible(iframe, 100)) {
                setDetectionInfo('hcaptcha', 85, `selector: ${selector} with visible iframe (blocking)`);
                break;
            }
        }
    }

    // ==================== FunCaptcha 检测 ====================

    const funcaptchaSelectors = ['#EnforcementChallenge', 'iframe[src*="arkoselabs.com"]', 'iframe[src*="funcaptcha.com"]'];
    for (const selector of funcaptchaSelectors) {
        const element = document.querySelector(selector);
        if (element && isElementVisible(element, 200)) {  // FunCaptcha通常较大
            setDetectionInfo('funcaptcha', 85, `selector: ${selector} (visible, blocking)`);
            break;
        }
    }

    // ==================== AWS WAF Captcha 检测 ====================

    if (document.title.includes('Human Verification')) {
        const pageText = document.body.innerText;
        if (pageText.includes('confirm you are human') || pageText.includes('Amazon')) {
            setDetectionInfo('aws_captcha', 90, 'title: Human Verification (Amazon WAF)');
        }
    }

    const awsSelectors = ['#captcha-container', '.amzn-captcha-lang-selector'];
    for (const selector of awsSelectors) {
        const element = document.querySelector(selector);
        if (element && isElementVisible(element, 0)) {
            const parentText = element.textContent.toLowerCase();
            if (parentText.includes('captcha') || parentText.includes('verification')) {
                setDetectionInfo('aws_captcha', 85, `selector: ${selector} (visible, blocking)`);
                break;
            }
        }
    }

    // ==================== Geetest 检测 ====================

    const geetestSelectors = ['.geetest_holder', '.geetest_widget', '.geetest_radar_tip'];
    for (const selector of geetestSelectors) {
        const element = document.querySelector(selector);
        if (element && isElementVisible(element, 100)) {
            setDetectionInfo('geetest', 80, `selector: ${selector} (visible, blocking)`);
            break;
        }
    }

    // ==================== DataDome 检测 ====================

    const datadomeElement = document.querySelector('.dd-captcha');
    if (datadomeElement && isElementVisible(datadomeElement, 100)) {
        setDetectionInfo('datadome', 85, 'element: .dd-captcha (visible, blocking)');
    }

    // DataDome 阻断页面
    const pageTextLower = document.body.innerText.toLowerCase();
    if (pageTextLower.includes('datadome') &&
        (pageTextLower.includes('blocked') || pageTextLower.includes('verify')) &&
        document.body.innerText.length < 2000) {
        setDetectionInfo('datadome', 80, 'text: DataDome block page');
    }

    // ==================== 通用阻断页面检测 ====================

    // 1. 通用 "Access blocked" - 必须是短页面
    if ((pageTextLower.includes('access blocked') || pageTextLower.includes('access denied')) &&
        document.body.innerText.length < 1500) {
        setDetectionInfo('access_blocked', 85, 'text: access blocked/denied (short dedicated page)');
    }

    // 2. Sucuri Firewall
    if (pageTextLower.includes('sucuri') &&
        (pageTextLower.includes('website firewall') || pageTextLower.includes('access denied'))) {
        setDetectionInfo('sucuri_firewall', 90, 'text: Sucuri Website Firewall block');
    }

    // 3. 403 Forbidden - 必须有明确的阻断文本
    if (document.title.includes('403') || document.title.includes('Forbidden')) {
        if ((pageTextLower.includes('forbidden') || pageTextLower.includes('access denied')) &&
            document.body.innerText.length < 2000) {
            setDetectionInfo('access_denied_403', 85, 'title: 403 + forbidden (dedicated page)');
        }
    }

    // 4. 设备验证/反爬虫检测
    if ((pageTextLower.includes('unusual activity') || pageTextLower.includes('automated requests')) &&
        (pageTextLower.includes('verify') || pageTextLower.includes('device')) &&
        document.body.innerText.length < 2000) {
        setDetectionInfo('device_verification', 85, 'text: unusual activity verification (blocking)');
    }

    // ==================== Reddit Security Block 检测 ====================

    const blockPageDiv = document.querySelector('div.font-bold.text-24.text-neutral-content-strong');
    const loginLink = document.querySelector('a[href="https://www.reddit.com/login/"]');
    const ticketLink = document.querySelector('a[href*="support.reddithelp.com"][href*="requests/new"]');

    if (blockPageDiv && loginLink && ticketLink) {
        setDetectionInfo('reddit_security_block', 95, 'structure: Reddit security block page');
    }

    // ==================== 遮罩层检测 ====================

    // 如果检测到高置信度的验证元素,同时有遮罩层,提高置信度
    if (detectionInfo.detected && detectionInfo.confidence >= 70 && hasBlockingOverlay()) {
        detectionInfo.confidence = Math.min(detectionInfo.confidence + 5, 100);
        detectionInfo.indicators.push('overlay: blocking overlay detected');
    }

    // ==================== 最终结果 ====================

    if (!detectionInfo.detected) {
        detectionInfo.type = 'none';
        detectionInfo.confidence = 0;
    }

    return {
        detected: detectionInfo.detected,
        type: detectionInfo.type || 'none',
        confidence: detectionInfo.confidence,
        indicators: detectionInfo.indicators,
        url: window.location.href,
        timestamp: new Date().toISOString()
    };
})();
