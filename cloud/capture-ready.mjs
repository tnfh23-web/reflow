// Shared by local and cloud captures. Observe readiness; never remove a site's
// loader or force hidden content visible just to produce a successful image.
export async function waitForCaptureReady(page, {timeout = 30000, minimum = 1500} = {}) {
  // Poll inside the browser. A remote CDP round trip for every observation and
  // sleep can consume the capture budget even after the page is already ready.
  const result = await page.evaluate(async ({timeout, minimum}) => {
    const started = Date.now(); let previous = '', stableSince = started, lastState;
    const visible = n => { const r = n.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0)) return false;
      for (let el = n; el; el = el.parentElement) {const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) <= .05) return false;}
      return true; };
    while (Date.now() - started < timeout) {
      const text = (document.body?.innerText || '').trim();
      const loaders = [...document.querySelectorAll('[aria-busy="true"],[role="progressbar"],.loader,.loading,.preloader,#preloader,.loading-overlay,.loading-screen,.loader-overlay,[class*="splash"],[id*="splash"],[class*="preloader"],[id*="preloader"]')];
      const blocked = loaders.some(n => { const r = n.getBoundingClientRect();
        return visible(n) && (n.getAttribute('aria-busy') === 'true' ||
          r.width * r.height > innerWidth * innerHeight * .15 || text.length < 160); });
      const loadingOnly = text.length < 160 && /^(?:loading(?:\s|\.|…|\d|%)*|로드\s*중[. …]*|로딩\s*중[. …]*|잠시만\s*기다려[\s\S]*|please\s*wait[. …]*)$/i.test(text);
      const images = [...document.images].filter(visible);
      const pendingImages = images.some(n => !n.complete);
      const videos = [...document.querySelectorAll('video')].filter(n => {const r=n.getBoundingClientRect();
        return r.width>0 && r.height>0 && r.top<innerHeight && r.bottom>0 && r.left<innerWidth && r.right>0;});
      // Some heroes keep the video transparent until its first frame decodes.
      const pendingVideo = videos.some(n =>
        (n.currentSrc || n.src || n.querySelector('source')) && !n.poster && n.readyState < 2);
      const visualContent = images.some(n => n.complete && n.naturalWidth > 0) ||
        [...document.querySelectorAll('body>div,main,article,section,h1,h2,p,canvas,video,svg')].some(visible);
      const state = {blocked,loadingOnly,pendingImages,pendingVideo,visualContent,fonts:document.fonts.status,
        ready: Boolean(document.body) && !blocked && !loadingOnly && !pendingImages && !pendingVideo &&
        visualContent && document.fonts.status !== 'loading',
        // Animated text may never stop. Observe layout and assets instead.
        fingerprint: document.documentElement.scrollHeight + '|' +
          [...document.querySelectorAll('main,h1')].slice(0,4).map(n => n.offsetWidth + ':' + n.offsetHeight).join('|') + '|' +
          images.map(n => n.complete + ':' + n.naturalWidth + ':' + n.naturalHeight).join('|') + '|' +
          videos.map(n => (n.readyState>=2) + ':' + n.videoWidth).join('|')};
      lastState = state; const now = Date.now();
      if (!state.ready || state.fingerprint !== previous) stableSince = now;
      previous = state.fingerprint;
      if (state.ready && now - started >= minimum && now - stableSince >= 750) return {ok:true};
      await new Promise(resolve => setTimeout(resolve, Math.min(250, Math.max(1, timeout - (now - started)))));
    }
    const {fingerprint,...readiness}=lastState||{};
    return {ok:false,readiness};
  }, {timeout,minimum});
  if (!result.ok) throw Object.assign(new Error('페이지 로딩이 끝나지 않아 캡처하지 못했어요. 잠시 뒤 재캡처하거나 이미지를 올려 주세요.'),{captureReadiness:result.readiness});
}

export async function prepareCapture(page) {
  await waitForCaptureReady(page);
  // Activate lazy images with one bounded browser-side scroll pass.
  await page.evaluate(async () => {
    const height = Math.min(16000, document.documentElement.scrollHeight);
    const step = Math.max(750, Math.ceil(height / 12));
    for (let y = 0; y < height; y += step) {
      window.scrollTo(0, y);
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
  await waitForCaptureReady(page, {timeout: 8000, minimum: 900});
}