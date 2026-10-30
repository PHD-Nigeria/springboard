/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node check script, not application code */
/*
 * Responsive checks for the REAL homepage featured-video panel (HR landscape,
 * Dare and CJ portrait), run against a dev server whose Supabase is the
 * fictional-data mock (HOME_URL, default http://127.0.0.1:3100/). Offline: every request to a
 * YouTube / Google host is intercepted and answered locally, so nothing contacts YouTube.
 * The page must make NO such request until a visitor presses play; thumbnails are the editor's own
 * Media Library images or a neutral branded fallback, never YouTube images. These checks prove
 * layout and behaviour, NOT how real thumbnails or real playback look.
 *   node verify-featured-video.cjs   (needs global `playwright`)
 */
const { chromium } = require('playwright');
const path = require('path');
const URL = process.env.HOME_URL || 'http://127.0.0.1:3100/';
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
    await ctx.route(/^https?:\/\/[^/]*(youtube|ytimg|googlevideo|google|gstatic)[^/]*\//, route => {
      const u = route.request().url();
      hits.push(u);
      if (u.includes('ytimg.com')) return route.fulfill({ contentType: 'image/svg+xml', body: SVG });
      return route.fulfill({ contentType: 'text/html', body: '<p>stub player</p>' });
    });
    await page.goto(URL);await page.waitForSelector("[data-testid=featured-video]");
    await page.waitForTimeout(400);
    const tag = `[${width}px]`;
    const innerHeight = width < 800 ? 800 : 900;
    const select = async id => {
      // Dev-server hydration can lag the first paint, so retry the click until the panel reports the new video.
      for (let i = 0; i < 10; i++) {
        await page.click(`[aria-label="Choose a featured video"] button[data-video-id="${id}"]`);
        try { await page.waitForFunction(v => document.querySelector('[data-testid=featured-video]').dataset.videoId === v, id, { timeout: 600 }); return; } catch {}
      }
    };
    const state = async () => { await page.waitForTimeout(250); return page.evaluate(() => {
      const f = document.querySelector('[data-testid=featured-video]');
      const st = document.querySelector('[data-testid=featured-video] .relative.overflow-hidden').getBoundingClientRect();
      const doc = document.documentElement;
      return {
        id: f.dataset.videoId, o: f.dataset.orientation, w: st.width, h: st.height, ratio: st.width / st.height,
        overflowX: doc.scrollWidth > doc.clientWidth + 1,
        fits: st.right <= doc.clientWidth + 1 && st.left >= -1,
        title: document.getElementById('featured-video-title').textContent,
        playBox: (() => { const b = document.querySelector('[data-testid=featured-video] button[aria-label^="Play video"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, label: b.getAttribute('aria-label') }; })(),
      };
    }); };

    // 1. HR is the initial featured video, 16:9
    let s = await state();
    ok(`${tag} HR is the initial featured video`, s.id === 'hIW7FrWtcHE' && s.title === 'HR');
    ok(`${tag} HR stage is 16:9`, s.o === 'landscape' && Math.abs(s.ratio - 16 / 9) < 0.02, `ratio ${s.ratio.toFixed(3)}`);
    ok(`${tag} no horizontal overflow (landscape)`, !s.overflowX && s.fits);
    ok(`${tag} play control named and at least 44px`, !!s.playBox && /Play video: HR/.test(s.playBox.label) && s.playBox.w >= 44 && s.playBox.h >= 44, JSON.stringify(s.playBox));
    ok(`${tag} NO request to YouTube or Google before the visitor presses play`, hits.length === 0, hits.join(', '));
    ok(`${tag} every video in the selector has a local thumbnail or the branded fallback, and no panel image comes from YouTube/Google`, await page.$$eval('[aria-label="Choose a featured video"] button', bs => bs.every(b => b.querySelector('[data-thumb]'))) && await page.$$eval('[data-testid=featured-video] img', imgs => imgs.every(i => !/ytimg|youtube|google|gstatic/.test(i.currentSrc || i.src))));

    // 2. Portrait videos keep 9:16 and fit the viewport width
    for (const [name, id] of [['Dare', 'jkEu3O_fX94'], ['CJ', 'V4g-MVnRom8']]) {
      await select(id);
      s = await state();
      ok(`${tag} ${name} selected, 9:16`, s.id === id && s.o === 'portrait' && Math.abs(s.ratio - 9 / 16) < 0.02, `ratio ${s.ratio.toFixed(3)} (${Math.round(s.w)}x${Math.round(s.h)})`);
      ok(`${tag} ${name} no horizontal overflow`, !s.overflowX && s.fits);
      ok(`${tag} ${name} stage compact: at most 530px and 72% of viewport height`, s.h <= 530 && s.h <= 0.72 * innerHeight + 1, `${Math.round(s.h)}px`);
      const pressed = await page.$$eval('[aria-label="Choose a featured video"] button', bs => bs.map(b => b.getAttribute('aria-pressed')).join());
      ok(`${tag} ${name} selector reports pressed state`, pressed.split(',').filter(x => x === 'true').length === 1);
    }

    // 3. Back to landscape restores 16:9
    await select('hIW7FrWtcHE');
    s = await state();
    ok(`${tag} returning to HR restores 16:9`, Math.abs(s.ratio - 16 / 9) < 0.02);

    // 4. Keyboard: tab to play, Enter loads the privacy-enhanced player only then
    await page.focus('[data-testid=featured-video] button[aria-label^="Play video"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid=featured-video] iframe');
    const src = await page.$eval('[data-testid=featured-video] iframe', f => ({ src: f.src, title: f.title, sandboxless: !f.hasAttribute('sandbox') }));
    ok(`${tag} Enter on play mounts youtube-nocookie iframe for HR`, src.src.startsWith('https://www.youtube-nocookie.com/embed/hIW7FrWtcHE?') && src.title === 'HR', src.src);
    ok(`${tag} after the click the only external host is the youtube-nocookie.com embed`, hits.length > 0 && hits.every(u => u.startsWith('https://www.youtube-nocookie.com/embed/')));

    // 5. Switching video after play replaces the player with the new poster
    await select('jkEu3O_fX94');
    s = await state();
    ok(`${tag} switching after play shows Dare poster again (no autoplay)`, s.id === 'jkEu3O_fX94' && !(await page.$('[data-testid=featured-video] iframe')) && !!s.playBox);

    // 6. Portrait click-through
    await page.click('[data-testid=featured-video] button[aria-label^="Play video"]');
    const psrc = await page.$eval('[data-testid=featured-video] iframe', f => f.src);
    ok(`${tag} Dare plays through youtube-nocookie`, psrc.startsWith('https://www.youtube-nocookie.com/embed/jkEu3O_fX94?'));
    await page.screenshot({ path: path.join(__dirname, `shot-home-video-${width}.png`) });
    ok(`${tag} no page errors`, errors.length === 0, errors.join('; '));
    await ctx.close();
  }
  await browser.close();
  const failed = results.filter(r => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
