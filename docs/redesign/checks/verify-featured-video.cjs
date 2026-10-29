/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node check script, not application code */
/*
 * Responsive checks for the featured-video component in the homepage prototype
 * (HR landscape, Dare and CJ portrait). Fully offline: every request to
 * i.ytimg.com / youtube-nocookie.com is intercepted and answered locally, so
 * nothing contacts YouTube and nothing real is loaded. The stubbed thumbnail is
 * a labelled 4:3 SVG, so these checks prove layout and behaviour, NOT how the
 * real YouTube thumbnails look (that needs visual review with network access).
 *   node verify-featured-video.cjs   (needs global `playwright`)
 */
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.join(__dirname, '../prototype/springboard-compact-home.html');
const WIDTHS = [1440, 1024, 768, 390];
const results = [];
const ok = (name, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#6c4bd0"/><text x="240" y="180" fill="#fff" text-anchor="middle" font-size="28">stub thumbnail</text></svg>';

(async () => {
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 800 ? 800 : 900 } });
    const page = await ctx.newPage();
    const hits = [];
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await ctx.route(/youtube|ytimg/, route => {
      const u = route.request().url();
      hits.push(u);
      if (u.includes('ytimg.com')) return route.fulfill({ contentType: 'image/svg+xml', body: SVG });
      return route.fulfill({ contentType: 'text/html', body: '<p>stub player</p>' });
    });
    await page.goto(URL);
    await page.waitForTimeout(400);
    const tag = `[${width}px]`;
    const state = () => page.evaluate(() => {
      const f = document.getElementById('featuredVideo');
      const st = document.getElementById('vfStage').getBoundingClientRect();
      const doc = document.documentElement;
      return {
        id: f.dataset.videoId, o: f.dataset.orientation, w: st.width, h: st.height, ratio: st.width / st.height,
        overflowX: doc.scrollWidth > doc.clientWidth + 1,
        fits: st.right <= doc.clientWidth + 1 && st.left >= -1,
        title: document.getElementById('vf-title').textContent,
        playBox: (() => { const b = document.getElementById('vfPlay'); if (!b) return null; const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, label: b.getAttribute('aria-label') }; })(),
      };
    });

    // 1. HR is the initial featured video, 16:9
    let s = await state();
    ok(`${tag} HR is the initial featured video`, s.id === 'hIW7FrWtcHE' && s.title === 'HR');
    ok(`${tag} HR stage is 16:9`, s.o === 'landscape' && Math.abs(s.ratio - 16 / 9) < 0.02, `ratio ${s.ratio.toFixed(3)}`);
    ok(`${tag} no horizontal overflow (landscape)`, !s.overflowX && s.fits);
    ok(`${tag} play control named and at least 44px`, !!s.playBox && /Play video: HR/.test(s.playBox.label) && s.playBox.w >= 44 && s.playBox.h >= 44, JSON.stringify(s.playBox));
    ok(`${tag} thumbnail requested from i.ytimg.com only, no player host before click`, hits.some(u => u.includes('i.ytimg.com/vi/hIW7FrWtcHE/')) && !hits.some(u => u.includes('youtube-nocookie')));

    // 2. Portrait videos keep 9:16 and fit the viewport width
    for (const [name, id] of [['Dare', 'jkEu3O_fX94'], ['CJ', 'V4g-MVnRom8']]) {
      await page.click(`#vfList button[data-id="${id}"]`);
      s = await state();
      ok(`${tag} ${name} selected, 9:16`, s.id === id && s.o === 'portrait' && Math.abs(s.ratio - 9 / 16) < 0.02, `ratio ${s.ratio.toFixed(3)} (${Math.round(s.w)}x${Math.round(s.h)})`);
      ok(`${tag} ${name} no horizontal overflow`, !s.overflowX && s.fits);
      ok(`${tag} ${name} stage not taller than 520px cap`, s.h <= 521, `${Math.round(s.h)}px`);
      const pressed = await page.$$eval('#vfList button', bs => bs.map(b => b.getAttribute('aria-pressed')).join());
      ok(`${tag} ${name} selector reports pressed state`, pressed.split(',').filter(x => x === 'true').length === 1);
    }

    // 3. Back to landscape restores 16:9
    await page.click('#vfList button[data-id="hIW7FrWtcHE"]');
    s = await state();
    ok(`${tag} returning to HR restores 16:9`, Math.abs(s.ratio - 16 / 9) < 0.02);

    // 4. Keyboard: tab to play, Enter loads the privacy-enhanced player only then
    await page.focus('#vfPlay');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#vfStage iframe');
    const src = await page.$eval('#vfStage iframe', f => ({ src: f.src, title: f.title, sandboxless: !f.hasAttribute('sandbox') }));
    ok(`${tag} Enter on play mounts youtube-nocookie iframe for HR`, src.src.startsWith('https://www.youtube-nocookie.com/embed/hIW7FrWtcHE?') && src.title === 'HR', src.src);
    ok(`${tag} player host is only youtube-nocookie.com after click`, hits.filter(u => !u.includes('ytimg.com')).every(u => u.startsWith('https://www.youtube-nocookie.com/embed/')));

    // 5. Switching video after play replaces the player with the new poster
    await page.click('#vfList button[data-id="jkEu3O_fX94"]');
    s = await state();
    ok(`${tag} switching after play shows Dare poster again (no autoplay)`, s.id === 'jkEu3O_fX94' && !(await page.$('#vfStage iframe')) && !!s.playBox);

    // 6. Portrait click-through
    await page.click('#vfPlay');
    const psrc = await page.$eval('#vfStage iframe', f => f.src);
    ok(`${tag} Dare plays through youtube-nocookie`, psrc.startsWith('https://www.youtube-nocookie.com/embed/jkEu3O_fX94?'));
    await page.screenshot({ path: path.join(__dirname, `shot-featured-video-${width}.png`) });
    ok(`${tag} no page errors`, errors.length === 0, errors.join('; '));
    await ctx.close();
  }
  await browser.close();
  const failed = results.filter(r => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
