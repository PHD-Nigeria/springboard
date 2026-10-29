const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = 'file://' + path.join(__dirname, 'test.html');
const axeSrc = fs.readFileSync(path.join(__dirname, 'node_modules/axe-core/axe.min.js'), 'utf8');
const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ---- Desktop ----
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await ctx.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(URL);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(__dirname, 'shot-home-1440.png') });

  // Seamless loop: the clone must start exactly one set-width after the first set, so -50% lands on an identical frame.
  const seam = await page.evaluate(() => {
    const sets = [...document.querySelectorAll('#track .set')];
    const a = sets[0].getBoundingClientRect(), b = sets[1].getBoundingClientRect();
    const track = document.getElementById('track').getBoundingClientRect();
    return { count: sets.length, aW: a.width, bW: b.width, offset: b.left - a.left, trackW: track.width, frames: sets[0].children.length };
  });
  ok('Ribbon has two identical sets', seam.count === 2 && Math.abs(seam.aW - seam.bW) < 0.5, JSON.stringify(seam));
  ok('Loop distance equals exactly 50% of track (no gap or jump at seam)', Math.abs(seam.offset - seam.trackW / 2) < 0.5, `offset ${seam.offset.toFixed(2)} vs half ${(seam.trackW / 2).toFixed(2)}`);
  const ribbonVisibleWidth = await page.evaluate(() => document.getElementById('ribbon').getBoundingClientRect().width);
  ok('One set is wider than the viewport (no blank area before loop)', seam.aW > ribbonVisibleWidth, `set ${seam.aW.toFixed(0)}px vs ribbon ${ribbonVisibleWidth.toFixed(0)}px`);

  // Visual seam test: pixel-compare the ribbon at progress 0 and at progress exactly 1 loop.
  const seamPix = await page.evaluate(async () => {
    const a = document.getElementById('track').getAnimations()[0];
    a.pause(); const dur = a.effect.getComputedTiming().duration;
    a.currentTime = 0; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const t0 = getComputedStyle(document.getElementById('track')).transform;
    a.currentTime = dur - 0.001; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const t1 = getComputedStyle(document.getElementById('track')).transform;
    return { dur, t0, t1 };
  });
  const diff = async () => {
    const r = await page.locator('#ribbon').boundingBox();
    await page.evaluate(() => { const a = document.getElementById('track').getAnimations()[0]; a.pause(); a.currentTime = 0; });
    await page.waitForTimeout(150); const A = (await page.screenshot({ clip: r })).toString('base64');
    await page.evaluate(() => { const a = document.getElementById('track').getAnimations()[0]; a.currentTime = a.effect.getComputedTiming().duration; });
    await page.waitForTimeout(150); const B = (await page.screenshot({ clip: r })).toString('base64');
    return page.evaluate(async ([A, B]) => {
      const load = s => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
      const [ia, ib] = await Promise.all([load(A), load(B)]);
      const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const x = c.getContext('2d');
      x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data;
      x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
      let diffPx = 0; for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i] || da[i+1] !== db[i+1] || da[i+2] !== db[i+2]) diffPx++;
      return { w: ia.width, h: ia.height, diffPx };
    }, [A, B]);
  };
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);
  const sd = await diff();
  ok('Seam pixel test: last frame of loop is pixel-identical to first frame', sd.diffPx === 0, `${sd.w}×${sd.h}px compared, ${sd.diffPx} differing pixels, loop ${(seamPix.dur / 1000).toFixed(1)}s`);
  await page.evaluate(() => document.getElementById('track').getAnimations()[0].play());

  ok('Ribbon speed is slow (≥ 60s per loop)', seamPix.dur >= 60000, `${(seamPix.dur / 1000).toFixed(1)}s`);

  // Pause button
  await page.click('#ribbon-ctl');
  const paused = await page.evaluate(() => getComputedStyle(document.getElementById('track')).animationPlayState);
  ok('Pause control stops motion', paused === 'paused');
  await page.click('#ribbon-ctl');

  // Off-screen pause
  await page.evaluate(() => scrollTo(0, 2500)); await page.waitForTimeout(400);
  const off = await page.evaluate(() => getComputedStyle(document.getElementById('track')).animationPlayState);
  ok('Ribbon pauses when scrolled off-screen', off === 'paused');
  const hdrSolid = await page.evaluate(() => document.getElementById('hdr').classList.contains('is-scrolled') && getComputedStyle(document.getElementById('hdr')).backgroundColor);
  ok('Header turns solid purple on scroll', hdrSolid === 'rgb(58, 0, 140)', String(hdrSolid));
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);

  // Keyboard nav
  await page.focus('.nav-trigger');
  await page.keyboard.press('ArrowDown');
  const firstFocused = await page.evaluate(() => document.activeElement.textContent.trim());
  const expanded = await page.getAttribute('.nav-trigger', 'aria-expanded');
  ok('ArrowDown opens dropdown and focuses first item', expanded === 'true' && firstFocused.startsWith('HR Corner'), firstFocused);
  await page.keyboard.press('ArrowDown');
  const second = await page.evaluate(() => document.activeElement.textContent.trim());
  ok('ArrowDown moves within dropdown', second.startsWith('Staff Spotlight'), second);
  await page.keyboard.press('Escape');
  const afterEsc = await page.evaluate(() => ({ exp: document.querySelector('.nav-trigger').getAttribute('aria-expanded'), focus: document.activeElement.classList.contains('nav-trigger') }));
  ok('Escape closes dropdown and returns focus to trigger', afterEsc.exp === 'false' && afterEsc.focus);
  const navLabels = await page.$$eval('#nav-list > li > .nav-trigger, #nav-list > li > .nav-link', n => n.map(x => x.textContent.trim()));
  const subLabels = await page.$$eval('#nav-list .panel a', n => n.map(x => x.textContent.replace('→', '').trim()));
  ok('All CMS nav groups present', JSON.stringify(navLabels) === JSON.stringify(['People & Culture', 'Company & Business', 'Engagement & Community', 'Search']), navLabels.join(' | '));
  ok('All 8 category links present', subLabels.length === 8, subLabels.join(', '));

  // Views + overflow at desktop
  for (const v of ['home', 'editions', 'edition', 'story', 'gallery', 'admin']) {
    await page.evaluate(h => { location.hash = h; }, v);
    await page.waitForTimeout(1200);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(`No horizontal overflow @1440 (${v})`, ov <= 0, `${ov}px`);
    await page.screenshot({ path: path.join(__dirname, `shot-${v}-1440.png`) });
  }
  // Archive generated from data: published only, newest first
  await page.evaluate(() => { location.hash = 'editions'; }); await page.waitForTimeout(1100);
  const eds = await page.$$eval('#ed-grid .big small', n => n.map(x => x.textContent));
  ok('Archive lists published editions newest first, draft hidden', JSON.stringify(eds) === JSON.stringify(['2026-Q2', '2026-Q1', '2025-Q4', '2025-Q3']), eds.join(', '));

  // Lightbox
  await page.evaluate(() => { location.hash = 'gallery'; }); await page.waitForTimeout(1100);
  await page.click('.g-item');
  await page.keyboard.press('ArrowRight');
  const cnt = await page.textContent('#lb-count');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  const lbClosed = await page.evaluate(() => !document.getElementById('lb').open && document.activeElement.classList.contains('g-item'));
  ok('Lightbox: arrows navigate, Escape closes, focus returns', cnt.startsWith('002') && lbClosed, cnt);

  // Admin sketch: edition filter + review gate
  await page.evaluate(() => { location.hash = 'admin'; }); await page.waitForTimeout(1100);
  await page.selectOption('#af-ed', 'none');
  const noneRows = await page.$$eval('#adm-rows tr', r => r.length);
  await page.selectOption('#af-ed', '2026-Q2');
  const q2Rows = await page.$$eval('#adm-rows tr', r => r.length);
  ok('Admin sketch: filter content by edition / unassigned', noneRows === 1 && q2Rows === 3, `none=${noneRows}, Q2=${q2Rows}`);
  await page.check('input[name=scope][value=none]'); await page.click('#submit-review');
  const blocked = await page.textContent('#scope-msg');
  await page.check('input[name=scope][value=evergreen]'); await page.click('#submit-review');
  const allowed = await page.textContent('#scope-msg');
  ok('Admin sketch: unassigned item cannot be submitted; explicit Evergreen can', /Choose an edition/.test(blocked) && /Evergreen/.test(allowed));
  await page.screenshot({ path: path.join(__dirname, 'shot-admin-1440.png'), fullPage: true });

  // Story orientation switch
  await page.evaluate(() => { location.hash = 'story'; }); await page.waitForTimeout(1100);
  await page.click('[data-o="portrait"]');
  const port = await page.evaluate(() => !!document.querySelector('.st-port'));
  ok('Story hero switches to portrait split layout', port);
  await page.screenshot({ path: path.join(__dirname, 'shot-story-portrait-1440.png') });

  // axe on each view
  for (const v of ['home', 'editions', 'edition', 'story', 'gallery', 'admin']) {
    await page.evaluate(h => { location.hash = h; }, v); await page.waitForTimeout(1100);
    await page.evaluate(axeSrc);
    const res = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(x => `${x.id}(${x.impact}) x${x.nodes.length}`));
    ok(`axe-core: no violations (${v})`, res.length === 0, res.join('; '));
  }
  const fresh = await ctx.newPage();
  await fresh.goto(URL); await fresh.waitForTimeout(5000);
  const cls = await fresh.evaluate(() => window.__cls);
  ok('Cumulative layout shift < 0.01 on home', cls < 0.01, cls.toFixed(4));
  await ctx.close();

  // ---- Tablet & mobile ----
  for (const [w, h] of [[768, 1024], [390, 844]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500 });
    const p = await c.newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(URL); await p.waitForTimeout(1400);
    for (const v of ['home', 'editions', 'edition', 'story', 'gallery', 'admin']) {
      await p.evaluate(x => { location.hash = x; }, v); await p.waitForTimeout(1100);
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok(`No horizontal overflow @${w} (${v})`, ov <= 0, `${ov}px`);
      await p.screenshot({ path: path.join(__dirname, `shot-${v}-${w}.png`), fullPage: v === 'home' && w === 390 });
    }
    await p.evaluate(() => { location.hash = 'home'; }); await p.waitForTimeout(1100);
    await p.click('#menu-btn'); await p.waitForTimeout(700);
    const dr = await p.evaluate(() => ({ open: document.getElementById('drawer').classList.contains('open'), focus: document.activeElement.id }));
    await p.screenshot({ path: path.join(__dirname, `shot-drawer-${w}.png`) });
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    const back = await p.evaluate(() => document.activeElement.id);
    ok(`Mobile menu @${w}: opens, focuses Close, Escape returns focus`, dr.open && dr.focus === 'drawer-close' && back === 'menu-btn', JSON.stringify(dr) + ' → ' + back);
    await c.close();
  }

  // ---- Reduced motion ----
  const rm = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const rp = await rm.newPage(); await rp.goto(URL); await rp.waitForTimeout(800);
  const rms = await rp.evaluate(() => ({ anim: getComputedStyle(document.getElementById('track')).animationName, clone: getComputedStyle(document.querySelectorAll('#track .set')[1]).display, scroll: getComputedStyle(document.getElementById('ribbon')).overflowX, h1: getComputedStyle(document.querySelector('.hero h1 .w > span')).transform }));
  ok('Reduced motion: ribbon static, duplicate hidden, scrollable, headline at rest', rms.anim === 'none' && rms.clone === 'none' && rms.scroll === 'auto' && (rms.h1 === 'none' || rms.h1 === 'matrix(1, 0, 0, 1, 0, 0)'), JSON.stringify(rms));
  await rp.screenshot({ path: path.join(__dirname, 'shot-home-reduced.png') });
  await rm.close();

  // ---- No JavaScript ----
  const nj = await browser.newContext({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
  const np = await nj.newPage(); await np.goto(URL); await np.waitForTimeout(800);
  const njs = await np.evaluate(() => ({ h1: document.querySelector('h1')?.textContent.trim().slice(0, 40), anim: getComputedStyle(document.getElementById('track')).animationName }));
  ok('Without JavaScript: headline renders, ribbon CSS animation still declared', !!njs.h1 && njs.anim === 'ribbon', JSON.stringify(njs));
  await np.screenshot({ path: path.join(__dirname, 'shot-home-nojs.png') });
  await nj.close();

  const env = errors.filter(e => e.includes('ERR_TUNNEL_CONNECTION_FAILED'));
  const real = errors.filter(e => !e.includes('ERR_TUNNEL_CONNECTION_FAILED'));
  ok('No script/page errors (excluding Google Fonts blocked by this sandbox)', real.length === 0, real.slice(0, 5).join(' | ') + (env.length ? ` [${env.length} font requests blocked by sandbox proxy]` : ''));
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 2));
  const failed = results.filter(x => !x.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
})();
