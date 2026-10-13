// Capture each document band while it is actually in the viewport. Scroll
// reveals can be reset when a full-page screenshot paints off-screen areas.
export async function capturePageTiles(page, {height, width = 1440, viewportHeight = 900} = {}) {
  const bandHeight = Math.floor(viewportHeight * .75);
  const count = Math.ceil(height / bandHeight);
  const settleMs = Math.min(1400, Math.max(700, Math.floor(27000 / count)));
  const tiles = [];
  let totalBytes = 0;
  for (let y = 0; y < height; y += bandHeight) {
    const band = Math.min(bandHeight, height - y);
    const actualY = await page.evaluate(async ({y, settleMs}) => {
      window.scrollTo({top:y, behavior:'instant'});
      await new Promise(resolve => setTimeout(resolve, settleMs));
      return window.scrollY;
    }, {y, settleMs});
    const offset = y - actualY;
    if (offset < 0 || offset + band > viewportHeight)
      throw new Error('Page changed size while capturing');
    // Fixed and sticky controls belong at their first appearance, not in
    // every stitched band. Leave all regular page content untouched.
    await page.evaluate(({offset, band, viewportHeight}) => {
      const seen = window.__reflowCaptureChromeSeen ||= new WeakSet();
      const hidden = [], fresh = [];
      for (const node of document.querySelectorAll('body *')) {
        const style = getComputedStyle(node), rect = node.getBoundingClientRect();
        if (!['fixed','sticky'].includes(style.position) || rect.height < 8 ||
          rect.height > viewportHeight * .25 || rect.width < 30 ||
          rect.top >= offset + band || rect.bottom <= offset) continue;
        if (seen.has(node)) {
          hidden.push([node, node.style.getPropertyValue('visibility'), node.style.getPropertyPriority('visibility')]);
          node.style.setProperty('visibility','hidden','important');
        } else fresh.push(node);
      }
      window.__reflowCaptureChromeHidden = hidden;
      window.__reflowCaptureChromeFresh = fresh;
    }, {offset, band, viewportHeight});
    try {
      const body = await page.screenshot({type:'jpeg', quality:82, timeout:10000,
        clip:{x:0, y:offset, width, height:band}});
      totalBytes += body.length;
      if (totalBytes > 12 * 1024 * 1024) throw new Error('Screenshot too large');
      tiles.push({y, body});
    } finally {
      await page.evaluate(() => {
        for (const [node, value, priority] of window.__reflowCaptureChromeHidden || [])
          node.style.setProperty('visibility', value, priority);
        for (const node of window.__reflowCaptureChromeFresh || [])
          window.__reflowCaptureChromeSeen.add(node);
        window.__reflowCaptureChromeHidden = [];
        window.__reflowCaptureChromeFresh = [];
      });
    }
  }
  return tiles;
}
