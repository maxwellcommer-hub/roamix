// Roamix home page. Plain JS, no libraries, nothing fetched from anywhere but this site.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // The app's springs, as functions of t in 0…1 (the same curves site.css samples).
  const spring = (response, damping) => {
    const w = 2 * Math.PI / response, z = damping, wd = w * Math.sqrt(1 - z * z);
    return t => 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + z * w / wd * Math.sin(wd * t));
  };
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // ── Reveal on view: .rise and anything that stamps in ──────────────────────────────
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .18, rootMargin: '0px 0px -6% 0px' });
  $$('.sect .rise, .foot .rise, .stub, .ticket').forEach(el => io.observe(el));

  // ── Goo: our opaque liquid glass ───────────────────────────────────────────────────
  // A goo surface is a set of rounded boxes. The canvas is painted as ONE vector outline:
  // the smooth-min union of the boxes' signed distance fields, contoured by marching squares
  // (edges interpolated, so the outline is exact to a fraction of a pixel) and filled as a
  // single path. Apart, a box keeps its true shape; within `k` of another it necks to it.
  const sdBox = (x, y, b) => {
    const r = Math.min(b.r, b.w / 2, b.h / 2);
    const qx = Math.abs(x - b.x - b.w / 2) - b.w / 2 + r, qy = Math.abs(y - b.y - b.h / 2) - b.h / 2 + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; };
  const union = (boxes, k) => (x, y) => {
    let d = 1e9;
    for (const b of boxes) d = d === 1e9 ? sdBox(x, y, b) : smin(d, sdBox(x, y, b), k);
    return d;
  };
  // paint field(x,y) (css px, negative inside) into a canvas, in one colour
  const paintGoo = (cv, field, color, step = 2, region) => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!region) ctx.clearRect(0, 0, W, H);
    const [x0, y0, x1, y1] = region || [0, 0, W, H];
    const nx = Math.ceil((x1 - x0) / step) + 1, ny = Math.ceil((y1 - y0) / step) + 1;
    const v = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = field(x0 + i * step, y0 + j * step);
    const p = new Path2D();
    const cx = [0, 1, 1, 0], cy = [0, 0, 1, 1];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const c = [v[j * nx + i], v[j * nx + i + 1], v[(j + 1) * nx + i + 1], v[(j + 1) * nx + i]];
      if (c[0] >= 0 && c[1] >= 0 && c[2] >= 0 && c[3] >= 0) continue;
      const X = x0 + i * step, Y = y0 + j * step;
      if (c[0] < 0 && c[1] < 0 && c[2] < 0 && c[3] < 0) { p.rect(X, Y, step, step); continue; }
      let first = true;
      for (let k = 0; k < 4; k++) {
        const n = (k + 1) % 4;
        if (c[k] < 0) { const px = X + cx[k] * step, py = Y + cy[k] * step; first ? p.moveTo(px, py) : p.lineTo(px, py); first = false; }
        if ((c[k] < 0) !== (c[n] < 0)) {
          const t = c[k] / (c[k] - c[n]);
          const px = X + (cx[k] + (cx[n] - cx[k]) * t) * step, py = Y + (cy[k] + (cy[n] - cy[k]) * t) * step;
          first ? p.moveTo(px, py) : p.lineTo(px, py); first = false;
        }
      }
      p.closePath();
    }
    ctx.fillStyle = color;
    ctx.fill(p);
  };
  // a critically-tuned spring you can retarget mid-flight (RoamixMotion's response/damping)
  class Spring {
    constructor(v, response, damping) { this.v = v; this.to = v; this.vel = 0; this.set(response, damping); }
    set(response, damping) { const w = 2 * Math.PI / response; this.k = w * w; this.c = 2 * damping * w; }
    step(dt) { const f = -this.k * (this.v - this.to) - this.c * this.vel; this.vel += f * dt; this.v += this.vel * dt; return this.busy(); }
    busy() { return Math.abs(this.v - this.to) > .0005 || Math.abs(this.vel) > .0005; }
    snap() { this.v = this.to; this.vel = 0; }
  }
  // one animation loop for every goo surface: each registers a tick(dt) → still busy?
  const ticking = new Set();
  let loopOn = false, lastT = 0;
  const loop = now => {
    const dt = Math.min(.034, (now - (lastT || now)) / 1000) || 1 / 60; lastT = now;
    for (const t of [...ticking]) if (!t(dt)) ticking.delete(t);
    if (ticking.size) requestAnimationFrame(loop); else { loopOn = false; lastT = 0; }
  };
  const wake = t => { ticking.add(t); if (!loopOn) { loopOn = true; requestAnimationFrame(loop); } };
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const INKS = { ink: cssVar('--ink'), paper: cssVar('--paper') };

  // ── Nav: one bar at the top; pinches into pills once you scroll ───────────────────────
  // The bar and the pills are two fields; the canvas paints a blend of them. Blending
  // distance fields (not pictures) is what makes the pinch: the bar thins between the pills,
  // necks, and lets go — then the ends round off.
  const nav = $('#nav'), navCv = $('canvas.goo', nav), foot = $('.foot');
  const navSplit = new Spring(0, .62, .7);
  // Geometry is measured once (and on resize), never per frame: reading layout inside an
  // animation forces the browser to recompute it, which is where jank comes from.
  let P0 = [];
  const measureNav = () => {
    const nb = nav.getBoundingClientRect();
    P0 = $$('.row > *', nav).filter(el => el.offsetWidth).map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.left - nb.left, y: 0, w: r.width, h: nb.height, r: nb.height / 2 };
    });
  };
  // painted once per shape in stock; the black is a GPU filter on the canvas (site.css), so
  // the flip to stock over the footer is a quick compositor fade with no repaint at all
  const paintNav = () => {
    const W = nav.clientWidth, H = nav.clientHeight;
    const bar = { x: 0, y: 0, w: W, h: H, r: H / 2 };
    const t = Math.max(-.08, Math.min(1.12, navSplit.v));
    // each pill reaches across its gap while the split is young, so the bar draws apart
    // like taffy (round ends all the way) instead of thinning to points over a wide gap
    const P = P0, reach = 1 - Math.min(1, Math.max(0, t));
    const S = P.map((b, i) => {
      const gl = i ? b.x - (P[i - 1].x + P[i - 1].w) : 0, gr = i < P.length - 1 ? P[i + 1].x - (b.x + b.w) : 0;
      const L = i ? (gl / 2 + H * .3) * reach : 0, R = i < P.length - 1 ? (gr / 2 + H * .3) * reach : 0;
      return { x: b.x - L, y: b.y, w: b.w + L + R, h: b.h, r: b.r };
    });
    // the neck reaches no further than the narrowest gap, so pills that sit close (a phone's
    // tight bar) still part cleanly at rest instead of staying bridged
    const minGap = Math.min(...P.slice(1).map((b, i) => b.x - (P[i].x + P[i].w)), 40);
    const U = union(S, Math.max(6, Math.min(20, minGap * .7)));
    if (t >= 1 - 1e-3 && t <= 1 + 1e-3) paintGoo(navCv, U, INKS.paper, 2);
    else if (Math.abs(t) < 1e-3) paintGoo(navCv, (x, y) => sdBox(x, y, bar), INKS.paper, 2);
    else paintGoo(navCv, (x, y) => { const a = sdBox(x, y, bar), b = U(x, y); return a + (b - a) * t; }, INKS.paper, 2);
  };
  const navTick = dt => { const a = navSplit.step(dt); paintNav(); return a; };
  let footTop = Infinity;
  const onScrollNav = () => {
    const split = scrollY > 40 ? 1 : 0;
    if (navSplit.to !== split) { navSplit.to = split; still ? (navSplit.snap(), paintNav()) : wake(navTick); }
    nav.classList.toggle('onink', scrollY + 40 > footTop);
  };
  const layoutNav = () => { measureNav(); footTop = foot.getBoundingClientRect().top + scrollY; paintNav(); };
  addEventListener('resize', layoutNav);
  navSplit.to = navSplit.v = scrollY > 40 ? 1 : 0;
  layoutNav(); onScrollNav();
  document.fonts?.ready.then(layoutNav);
  addEventListener('load', layoutNav);
  // ?goo-debug: freeze the pinch at any point, to look at a single frame of it
  if (location.search.includes('goo-debug')) window.gooNav = v => { navSplit.v = navSplit.to = v; navSplit.vel = 0; paintNav(); };

  // the link lozenge: leading edge on a quick spring, trailing edge on a slower one,
  // so a move stretches it out and thins it, and it lands round
  const links = $$('.nav .links a'), pick = $('.nav .pick');
  const eL = new Spring(0, .34, .72), eR = new Spring(0, .34, .72);
  // a page of its own (the legal pages) marks its link aria-current; the home page's spy
  // takes over from it wherever there are sections to watch
  let current = links.find(l => l.getAttribute('aria-current') === 'page') || null, placed = false;
  const drawPick = () => {
    const w = Math.max(0, eR.v - eL.v), rest = Math.max(1, eR.to - eL.to);
    const stretch = Math.max(0, w / rest - 1);
    const H0 = pick.offsetHeight || 40, h = H0 / (1 + stretch * .55);
    pick.style.width = `${w}px`;
    pick.style.transform = `translate3d(${eL.v}px, ${(H0 - h) / 2}px, 0) scaleY(${h / H0})`;
  };
  const pickTick = dt => { const a = eL.step(dt), b = eR.step(dt); drawPick(); return a || b; };
  const moveTo = a => {
    links.forEach(l => l.classList.toggle('on', l === a));
    if (!a) { pick.classList.remove('live'); placed = false; return; }
    const box = a.parentElement.getBoundingClientRect(), r = a.getBoundingClientRect();
    const L = r.left - box.left, R = L + r.width;
    const right = L > eL.to;
    eL.to = L; eR.to = R;
    // the edge in the direction of travel leads; the other trails
    (right ? eR : eL).set(.3, .78); (right ? eL : eR).set(.52, .7);
    if (!placed || still) { eL.snap(); eR.snap(); drawPick(); placed = true; }
    else wake(pickTick);
    pick.classList.add('live');
  };
  links.forEach(a => {
    a.addEventListener('pointerenter', () => moveTo(a));
    a.addEventListener('focus', () => moveTo(a));
  });
  $('.nav .links')?.addEventListener('pointerleave', () => moveTo(current));
  // only links to a section of THIS page are watched (the legal pages link back to the home's)
  const watched = links.filter(a => a.getAttribute('href').startsWith('#'));
  const sections = watched.map(a => $(a.getAttribute('href'))).filter(Boolean);
  let spans = [];
  // "How" covers the record section after it too: it's still the how of the app
  const extendsTo = { fills: 'miles' };
  const measureSpy = () => { spans = sections.map(sec => {
    const r = sec.getBoundingClientRect(), more = extendsTo[sec.id] && document.getElementById(extendsTo[sec.id]);
    return [r.top + scrollY, (more ? more.getBoundingClientRect().bottom : r.bottom) + scrollY];
  }); };
  measureSpy(); addEventListener('resize', measureSpy); addEventListener('load', measureSpy);
  let hovering = false;
  $('.nav .links')?.addEventListener('pointerenter', () => hovering = true);
  $('.nav .links')?.addEventListener('pointerleave', () => hovering = false);
  const spy = () => {
    if (!spans.length) return;
    const y = scrollY + innerHeight * .4; let hit = null;
    spans.forEach(([t, b], i) => { if (t < y && b > y) hit = watched[i]; });
    if (hit !== current) { current = hit; if (!hovering) moveTo(current); }
  };
  // ── The browser's own bar takes the colour of what's under it ──────────────────────────
  // A Safari tab never draws the page under the status bar: it paints that band itself, from
  // theme-color. So theme-color follows the page — the ground of whatever section (or, in
  // the tour, whichever plate) sits at the top of the screen — and the band reads as the
  // page running on up to the edge.
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  // Safari 26 ignores theme-color. It colours its status bar and toolbar from a fixed/sticky
  // element at each edge (within ~4px of the top / 3px of the bottom, 80%+ wide, 3px+ tall),
  // and only re-reads a strip's colour when the strip APPEARS. So: a 12px solid strip at each
  // edge (iOS only, site.css), re-inserted whenever its colour changes.
  const strip = side => { const d = document.createElement('div'); d.className = 'tintbar ' + side; d.setAttribute('aria-hidden', 'true'); return d; };
  const bars = { top: strip('top'), bottom: strip('bottom') }, barColour = { top: '', bottom: '' };
  const setBar = (side, c) => {
    if (!c || barColour[side] === c) return;
    barColour[side] = c;
    const old = bars[side], fresh = strip(side); fresh.style.backgroundColor = c;
    bars[side] = fresh; old.remove(); document.body.append(fresh);
  };
  let tintSpans = [], tintNow = '', plateTint = null, tourPin = null;
  const measureTint = () => { tintSpans = $$('[data-tint]').filter(el => !el.classList.contains('plate')).map(el => { const r = el.getBoundingClientRect(); return [r.top + scrollY, r.bottom + scrollY, el.dataset.tint]; }); };
  const colourAt = y => { for (const [t, b, col] of tintSpans) if (t <= y && b > y) return col; return null; };
  const tint = () => {
    if (!themeMeta) return;
    const tourC = plateTint ? plateTint() : null;
    const top = tourC || colourAt(scrollY + 1), bottom = tourC || colourAt(scrollY + innerHeight - 2) || top;
    if (top && top !== tintNow) {
      themeMeta.setAttribute('content', top); tintNow = top;
      document.documentElement.style.backgroundColor = top; document.body.style.backgroundColor = top;
    }
    setBar('top', top); setBar('bottom', bottom);
    // The tour's frame is sticky (native, so it never trails the finger), and Safari reads a
    // sticky element's own colour too: it wears the colour of the plate under the middle.
    if (tourPin) {
      const pc = tourC || tourPin.dataset.first;
      if (pc && tourPin.dataset.cur !== pc) { tourPin.style.backgroundColor = pc; tourPin.dataset.cur = pc; }
    }
  };
  measureTint(); addEventListener('load', measureTint);

  // ONE scroll handler, run at most once a frame
  const onScrollFns = [onScrollNav, spy, tint];
  let scrollQueued = false;
  addEventListener('scroll', () => {
    if (scrollQueued) return; scrollQueued = true;
    requestAnimationFrame(() => { scrollQueued = false; onScrollFns.forEach(f => f()); });
  }, { passive: true });

  // ── Goo buttons: the pill swells where your pointer is and the swell follows it along,
  //    like a finger pressed up under a skin of ink. Nothing comes loose. ────────────────
  $$('.gbtn').forEach(btn => {
    const cv = $('canvas.goo', btn), PADX = 64, PADY = 40;
    const hov = new Spring(0, .5, .62), press = new Spring(0, .28, .6), at = new Spring(.5, .32, .8);
    const paint = () => {
      const fill = getComputedStyle(btn).getPropertyValue('--fill').trim() || INKS.paper;
      const w = btn.offsetWidth, h = btn.offsetHeight, t = Math.max(0, hov.v), q = press.v;
      const body = { x: PADX + q * 4, y: PADY + q * 3, w: w - q * 8, h: h - q * 6, r: (h - q * 6) / 2 };
      // the swell: a disc a little taller than the pill, riding under the pointer
      const R = h / 2 * (1 + .24 - .1 * q);
      const cx = PADX + h / 2 + (w - h) * Math.min(1, Math.max(0, at.v));
      const swell = { x: cx - R, y: PADY + h / 2 - R, w: 2 * R, h: 2 * R, r: R };
      // blended in by the hover itself, so at rest the pill is exactly a pill
      const U = union([body, swell], 40);
      paintGoo(cv, t < .002 ? (x, y) => sdBox(x, y, body) : (x, y) => { const a = sdBox(x, y, body); return a + (U(x, y) - a) * Math.min(1, t); }, fill, 1.5);
    };
    const tick = dt => { const a = hov.step(dt), b = press.step(dt), c = at.step(dt); paint(); return a || b || c; };
    const go = (s, v) => { s.to = v; still ? (s.snap(), paint()) : wake(tick); };
    const track = e => { const r = btn.getBoundingClientRect(); go(at, (e.clientX - r.left - r.height / 2) / Math.max(1, r.width - r.height)); };
    btn.addEventListener('pointerenter', e => { at.v = at.to = Math.min(1, Math.max(0, (e.clientX - btn.getBoundingClientRect().left) / btn.offsetWidth)); go(hov, 1); track(e); });
    btn.addEventListener('pointermove', track);
    btn.addEventListener('pointerleave', () => { go(hov, 0); go(press, 0); });
    btn.addEventListener('focus', () => { go(at, .5); go(hov, 1); });
    btn.addEventListener('blur', () => go(hov, 0));
    btn.addEventListener('pointerdown', () => go(press, 1));
    btn.addEventListener('pointerup', () => go(press, 0));
    new ResizeObserver(paint).observe(btn);
    document.fonts?.ready.then(paint);
  });

  // ── In-page links glide to their section instead of jumping ─────────────────────────
  // An eased scroll whose length follows the distance; a wheel, touch or key stops it, so
  // it never fights the reader.
  let glide = 0;
  const stopGlide = () => { glide = 0; };
  ['wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, stopGlide, { passive: true }));
  const glideTo = y => {
    const from = scrollY, dist = y - from;
    if (still || Math.abs(dist) < 2) { scrollTo(0, y); return; }
    const T = Math.min(1300, Math.max(520, Math.abs(dist) * .35)), t0 = performance.now(), id = ++glide;
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const run = now => {
      if (id !== glide) return;
      const t = Math.min(1, (now - t0) / T);
      scrollTo(0, from + dist * ease(t));
      if (t < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  };
  $$('a[href^="#"], a[href="./"]').forEach(a => a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    const target = href === './' ? document.body : $(href);
    if (!target || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const y = href === './' ? 0 : target.getBoundingClientRect().top + scrollY;
    glideTo(Math.min(y, document.documentElement.scrollHeight - innerHeight));
    history.replaceState(null, '', href === './' ? location.pathname : href);
  }));

  // ── A light smooth scroll, for a mouse wheel or trackpad only ───────────────────────────
  // Touch keeps the phone's own scrolling (nothing beats it), and so do the keyboard and the
  // scrollbar. Each wheel step moves a target; the page eases toward it, frame-rate
  // independent, and lets go the moment it arrives. Reduced Motion turns it off.
  if (matchMedia('(pointer: fine)').matches && !still) {
    let target = scrollY, cur = scrollY, running = false, last = 0;
    const maxY = () => document.documentElement.scrollHeight - innerHeight;
    const step = now => {
      const dt = Math.min(48, now - (last || now)) / 16.67; last = now;
      cur += (target - cur) * (1 - Math.pow(1 - .16, dt));
      if (Math.abs(target - cur) < .5) { cur = target; running = false; last = 0; }
      scrollTo(0, cur);
      if (running) requestAnimationFrame(step);
    };
    addEventListener('wheel', e => {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.target.closest('.toc')) return;
      e.preventDefault();
      if (!running) { cur = scrollY; target = scrollY; }
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      target = Math.min(maxY(), Math.max(0, target + dy));
      if (!running) { running = true; requestAnimationFrame(step); }
    }, { passive: false });
    // anything else that scrolls the page (a link glide, the keyboard) resets the target
    addEventListener('scroll', () => { if (!running) target = cur = scrollY; }, { passive: true });
  }

  let sizePano = () => {};
  // Each section below runs only on a page that has it (the legal pages share this file).
  if ($('.hero')) {
  // ── Hero: land fades up, the route draws itself, airports stamp down as it reaches them ─
  const hero = $('.hero');
  const route = $('#route'), mask = $('#route-mask'), puck = $('#puck');
  const ports = $$('.hero .port');
  const len = mask.getTotalLength();
  // where along the route each airport sits
  const portAt = ports.map(p => {
    const x = +p.dataset.x, y = +p.dataset.y; let best = 0, bd = Infinity;
    for (let s = 0; s <= len; s += 4) { const q = mask.getPointAtLength(s); const d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < bd) { bd = d; best = s; } }
    return best;
  });
  mask.style.strokeDasharray = `${len} ${len}`;
  const setDraw = f => {
    const at = len * f;
    mask.style.strokeDashoffset = len - at;
    ports.forEach((p, i) => p.classList.toggle('on', at >= portAt[i] - 2));
    const q = mask.getPointAtLength(at);
    puck.setAttribute('cx', q.x); puck.setAttribute('cy', q.y);
  };

  // tagline: a departures-board settle, letter by letter
  const tag = $('#tagline');
  const flapIn = (el, text, done) => {
    if (still) { el.textContent = text; done?.(); return; }
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    el.textContent = '';
    const spans = [...text].map(ch => { const s = document.createElement('span'); s.className = 'flap'; s.textContent = ch === ' ' ? ' ' : ''; el.append(s); return { s, ch }; });
    const t0 = performance.now();
    const tick = now => {
      let settled = 0;
      spans.forEach(({ s, ch }, i) => {
        if (ch === ' ') { settled++; return; }
        const land = 260 + i * 38;
        if (now - t0 >= land) { s.textContent = ch; settled++; }
        else if (now - t0 > i * 18) s.textContent = /[a-z]/i.test(ch) ? glyphs[(Math.random() * 26) | 0] : ch;
      });
      if (settled < spans.length) requestAnimationFrame(tick); else { el.textContent = text; done?.(); }
    };
    requestAnimationFrame(tick);
  };

  const startHero = () => {
    hero.classList.add('in');
    $$('.hero .rise').forEach(el => el.classList.add('in'));
    if (still) { setDraw(1); tag.textContent = 'Every trip. One map.'; return; }
    setTimeout(() => flapIn(tag, 'Every trip. One map.'), 300);
    puck.classList.add('on');
    const T = 5200, t0 = performance.now() + 500;
    const run = now => {
      const t = Math.min(1, Math.max(0, (now - t0) / T));
      setDraw(easeInOut(t));
      if (t < 1) requestAnimationFrame(run); else puck.classList.remove('on');
    };
    requestAnimationFrame(run);
  };
  // keep the route and its airport labels well clear of the lockup: measure where the line
  // and labels fall over the wordmark's width, and lift the atlas until there's air
  const mapLayers = [$('.hero .map'), $('.hero .routes')];
  const clearLogo = () => {
    mapLayers.forEach(l => l.style.translate = '');
    const wmEl = $('.hero .wordmark'), r0 = wmEl.getBoundingClientRect();
    const rise = parseFloat((getComputedStyle(wmEl).translate || '0 0').split(' ')[1]) || 0;
    const wm = { left: r0.left, right: r0.right, top: r0.top - rise, width: r0.width };
    const svg = $('.hero .routes'), M = svg.getScreenCTM();
    if (!M || !wm.width) return;
    const L = wm.left - 70, R = wm.right + 70;
    let low = -Infinity;
    for (let s = 0; s <= len; s += 6) {
      const q = mask.getPointAtLength(s), x = M.a * q.x + M.c * q.y + M.e, y = M.b * q.x + M.d * q.y + M.f;
      if (x > L && x < R) low = Math.max(low, y + 6);
    }
    ports.forEach(p => { const b = p.getBoundingClientRect(); if (b.right > L && b.left < R) low = Math.max(low, b.bottom); });
    const air = Math.max(56, innerHeight * .07);
    const lift = Math.min(innerHeight * .22, Math.max(0, low + air - wm.top));
    if (lift) mapLayers.forEach(l => l.style.translate = `0 ${-lift}px`);
  };
  clearLogo();
  addEventListener('resize', clearLogo);
  document.fonts?.ready.then(clearLogo);
  setDraw(0);
  if (document.readyState === 'complete') startHero(); else addEventListener('load', startHero);
  // fonts can land after load on a slow line; don't hold the page for them
  setTimeout(() => { if (!hero.classList.contains('in')) startHero(); }, 2500);

  }
  if ($('#tour')) {
  // ── Tour: vertical scroll drives the strip sideways ─────────────────────────────────
  const pano = $('#tour'), strip = $('#strip'), plates = $$('.plate', strip);
  const ticks = $('#ticks'), num = $('#pano-n');
  plates.forEach(() => ticks.append(document.createElement('i')));
  // each plate shows its own ink until its picture arrives, and the picture fades in over it;
  // the pictures start loading while the tour is still a screen and a half away
  const pinEl = $('.pin', pano);
  tourPin = pinEl; pinEl.dataset.first = plates[0].dataset.tint;
  plates.forEach(p => {
    p.style.backgroundColor = p.dataset.tint;
    const img = $('img', p), done = () => img.classList.add('loaded');
    img.complete && img.naturalWidth ? done() : img.addEventListener('load', done, { once: true });
  });
  const early = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    early.disconnect(); plates.forEach(p => { $('img', p).loading = 'eager'; });
  }, { rootMargin: '150% 0px 150% 0px' });
  early.observe(pano);
  const tickEls = $$('i', ticks);
  // measured on resize only; the scroll path is pure arithmetic and one transform write
  let travel = 0, panoTop = 0, plateW = 1, lastOn = -1, lastF = -1;
  // sized from the pinned frame (100lvh: the full screen, which a phone's address bar showing
  // and hiding does NOT change) and only re-sized when the WIDTH changes — re-sizing on every
  // address-bar move is what made the page jump and stutter on a phone
  const pin = $('.pin', pano);
  let sizedW = 0;
  sizePano = (force) => {
    if (!force && sizedW === innerWidth && travel) return;
    sizedW = innerWidth;
    plateW = plates[0].offsetWidth || 1;
    travel = Math.max(0, plateW * plates.length - innerWidth);
    pano.style.height = `${pin.offsetHeight + travel}px`;
    strip.style.setProperty('--travel', `${-travel}px`);
    panoTop = pano.getBoundingClientRect().top + scrollY;
    if (cssDriven) {
      strip.style.animationRange = `${panoTop}px ${panoTop + travel}px`;
    }
    lastF = -1; panoScroll();
  };
  // Where the browser can, the strip is a scroll-driven CSS animation, so it moves on the
  // compositor in lockstep with the finger — a JS transform written after each scroll event
  // trails the touch on a phone and judders. JS only keeps the ticks and labels.
  const cssDriven = CSS.supports('animation-timeline: scroll()') && !still;
  if (cssDriven) strip.classList.add('scroll-driven');
  const panoScroll = () => {
    const top = panoTop - scrollY, f = travel ? Math.min(1, Math.max(0, -top / travel)) : 0;
    if (!cssDriven && f !== lastF) { strip.style.transform = `translate3d(${-f * travel}px,0,0)`; lastF = f; }
    nav.classList.toggle('away', top <= 1 && top + travel >= -1);
    if (top > innerHeight) return;
    const x = f * travel; // strip offset
    const on = Math.min(plates.length - 1, Math.max(0, Math.floor((x + innerWidth / 2) / plateW)));
    if (top < innerHeight * .5) {
      const last = Math.floor((x + innerWidth * .85) / plateW);
      for (let i = Math.max(0, Math.floor(x / plateW)); i <= Math.min(plates.length - 1, last); i++) plates[i].classList.add('seen');
    }
    if (on !== lastOn) { tickEls.forEach((t, i) => t.classList.toggle('on', i === on)); num.textContent = String(on + 1).padStart(2, '0'); lastOn = on; }
  };
  onScrollFns.push(panoScroll);
  plateTint = () => {
    const top = panoTop - scrollY;
    if (top > 0 || top + travel < 0) return null;            // the strip isn't pinned
    const x = Math.min(1, Math.max(0, -top / (travel || 1))) * travel;
    return plates[Math.min(plates.length - 1, Math.floor((x + innerWidth / 2) / plateW))].dataset.tint;
  };
  addEventListener('resize', () => sizePano());
  addEventListener('load', () => sizePano(true));
  $$('img', strip).forEach(img => img.complete || img.addEventListener('load', () => sizePano(true), { once: true }));
  if (still) plates.forEach(p => p.classList.add('seen'));

  }
  if ($('#board')) {
  // ── The departures board ────────────────────────────────────────────────────────────
  const CELLS = 9, GL = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rows = $$('#board .row');
  rows.forEach(row => {
    const box = $('.cells', row);
    for (let i = 0; i < CELLS; i++) {
      const c = document.createElement('span'); c.className = 'cell';
      c.innerHTML = '<span class="face"></span><span class="leaf"></span>';
      box.append(c);
    }
  });
  const setCell = (c, ch) => { $('.face', c).textContent = ch; $('.leaf', c).textContent = ch; };
  const roll = (row, word) => {
    const cells = $$('.cell', row), target = word.padEnd(CELLS).slice(0, CELLS);
    cells.forEach((c, i) => {
      const goal = target[i];
      if (still) { setCell(c, goal); return; }
      let n = 6 + i * 2 + ((Math.random() * 4) | 0);
      const step = () => {
        if (n-- <= 0) { setCell(c, goal); return; }
        setCell(c, GL[(Math.random() * GL.length) | 0]);
        c.classList.remove('flip'); void c.offsetWidth; c.classList.add('flip');
        setTimeout(step, 62);
      };
      setTimeout(step, i * 30);
    });
  };
  rows.forEach(row => {
    $$('.cell', row).forEach(c => setCell(c, ' '));
    let showingTo = false;
    row.addEventListener('click', () => { showingTo = !showingTo; roll(row, showingTo ? row.dataset.to : row.dataset.from); });
    row._show = () => { showingTo = true; roll(row, row.dataset.to); };
    row._from = () => roll(row, row.dataset.from);
  });
  const boardIO = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    boardIO.disconnect();
    rows.forEach((r, i) => { r._from(); setTimeout(() => r._show(), 1300 + i * 260); });
  }, { threshold: .5 });
  boardIO.observe($('#board'));

  }
  if ($('#bubbles')) {
  // ── Every mile, counted: the You tab's tiles, alive. Each one floats a few points round
  //    its spot (same-ink tiles fuse where they drift together); grab one and it lifts off
  //    the sheet onto its own layer — free to go anywhere on the screen — while the others
  //    ease out of its way; let go and it springs home and settles back into the goo. The
  //    loop runs only while the section is on screen. ──────────────────────────────────────
  const field = $('#bubbles');
  const INK = { verm: ['#E8401E', '#F7F4ED'], sky: ['#1180CE', '#F7F4ED'], chrome: ['#F5B301', '#16150F'], palm: ['#12795A', '#F7F4ED'] };
  // value, label, ink, size, home (centre, as a fraction of the field)
  const data = [
    ['14', 'trips', 'verm', 1.0, .50, .16], ['23.4k', 'miles', 'sky', 1.22, .45, .43], ['112', 'places', 'palm', 1.04, .71, .81],
    ['21', 'cities', 'palm', .86, .44, .80], ['64%', 'driven', 'sky', .94, .53, .63], ['31%', 'flown', 'verm', .9, .21, .67],
    ['0.9×', 'around the earth', 'chrome', 1.0, .15, .43], ['9:40', 'usual departure', 'chrome', .92, .79, .55],
  ];
  const labels = $('.labels', field), bubCv = $('canvas.goo', field);
  const B = data.map(([v, l, ink, s, hx, hy], i) => {
    const lab = document.createElement('div'); lab.style.color = INK[ink][1];
    lab.innerHTML = `<div><b data-v="${v}">${v}</b><small>${l}</small></div>`;
    labels.append(lab);
    return { lab, s, ink, hx, hy, w: 0, h: 0, away: false, ox: new Spring(0, .9, .55), oy: new Spring(0, .9, .55), ph: i * 1.7, fq: .6 + (i % 4) * .13 };
  });
  let FW = 0, FH = 0, clock = 0;
  const box = b => ({ x: b.hx * FW - b.w / 2 + b.ox.v, y: b.hy * FH - b.h / 2 + b.oy.v, w: b.w, h: b.h, r: b.h * .3 });
  const homeBox = b => ({ x: b.hx * FW - b.w / 2, y: b.hy * FH - b.h / 2, w: b.w, h: b.h, r: b.h * .3 });
  const paintBubbles = () => {
    if (!FW) return;
    const ctx = bubCv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, bubCv.width, bubCv.height);
    for (const ink of Object.keys(INK)) {
      const boxes = B.filter(b => b.ink === ink && !b.away).map(box);
      if (!boxes.length) continue;
      // only the area these tiles can reach is evaluated
      const x0 = Math.max(0, Math.min(...boxes.map(q => q.x)) - 24), y0 = Math.max(0, Math.min(...boxes.map(q => q.y)) - 24);
      const x1 = Math.min(FW, Math.max(...boxes.map(q => q.x + q.w)) + 24), y1 = Math.min(FH, Math.max(...boxes.map(q => q.y + q.h)) + 24);
      paintGoo(bubCv, union(boxes, 26), INK[ink][0], 3, [x0, y0, x1, y1]);
    }
    B.forEach(b => { if (!b.away) { const q = box(b); b.lab.style.transform = `translate3d(${q.x}px,${q.y}px,0)`; } });
  };
  const sizeBubbles = () => {
    FW = field.clientWidth; FH = field.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    bubCv.width = Math.round(FW * dpr); bubCv.height = Math.round(FH * dpr);
    const base = Math.min(FW, FH) * .17;
    B.forEach(b => { b.h = base * b.s; b.w = b.h * 1.6; b.lab.style.width = b.w + 'px'; b.lab.style.height = b.h + 'px'; });
    paintBubbles();
  };
  new ResizeObserver(sizeBubbles).observe(field);

  // the lifted tile: a real element on a fixed layer, so it can go anywhere on the page
  const lift = document.createElement('div'); lift.className = 'lift'; lift.setAttribute('aria-hidden', 'true');
  document.body.append(lift);
  let held = null, gx = 0, gy = 0, home = null, fieldRect = null;
  const sx = new Spring(0, .5, .66), sy = new Spring(0, .5, .66), sc = new Spring(1, .3, .6);
  const drawLift = () => { lift.style.transform = `translate3d(${sx.v}px,${sy.v}px,0) scale(${sc.v})`; };

  // one loop drives the float, the making-room and the flight home
  let onScreen = false;
  const tick = dt => {
    clock += dt;
    fieldRect = field.getBoundingClientRect();
    // where the lifted tile is, in the field's own coordinates
    const L = home ? { x: sx.v - fieldRect.left, y: sy.v - fieldRect.top, w: home.b.w, h: home.b.h } : null;
    for (const b of B) {
      if (b.away) continue;
      let tx = still ? 0 : Math.sin(clock * b.fq + b.ph) * 9, ty = still ? 0 : Math.cos(clock * b.fq * 1.27 + b.ph) * 7;
      if (L) {
        // ease out of the lifted tile's way, along whichever axis is shorter to clear
        const q = homeBox(b), pad = 14;
        const dx = (q.x + q.w / 2) - (L.x + L.w / 2), dy = (q.y + q.h / 2) - (L.y + L.h / 2);
        const ox = (q.w + L.w) / 2 + pad - Math.abs(dx), oy = (q.h + L.h) / 2 + pad - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox < oy) tx += Math.sign(dx || 1) * Math.min(ox, 90); else ty += Math.sign(dy || 1) * Math.min(oy, 90);
        }
      }
      b.ox.to = tx; b.oy.to = ty; b.ox.step(dt); b.oy.step(dt);
    }
    if (home) {
      if (!held) {
        const q = box(home.b);
        sx.to = fieldRect.left + q.x; sy.to = fieldRect.top + q.y;
        sx.step(dt); sy.step(dt);
        const near = Math.abs(sx.v - sx.to) + Math.abs(sy.v - sy.to) < .6 && Math.abs(sx.vel) + Math.abs(sy.vel) < 10 && Math.abs(sc.v - 1) < .004;
        if (near) { home.b.away = false; home.b.lab.style.visibility = ''; lift.style.display = 'none'; home = null; }
      }
      sc.step(dt);
      if (home) drawLift();
    }
    paintBubbles();
    return onScreen || !!home;
  };
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) wake(tick); }).observe(field);

  const tileAt = e => {
    const r = field.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    return B.find(b => { if (b.away) return false; const q = box(b); return x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h; });
  };
  // mouse: a press picks the tile up. touch: it waits to see which way the finger goes —
  // up or down is the page scrolling (the browser keeps it), sideways picks the tile up
  let pending = null;
  field.addEventListener('pointerdown', e => {
    const b = tileAt(e); if (!b || home) return;
    if (e.pointerType === 'touch') { pending = { b, x: e.clientX, y: e.clientY, id: e.pointerId }; return; }
    e.preventDefault(); startLift(b, e);
  });
  const startLift = (b, e) => {
    try { field.setPointerCapture(e.pointerId); } catch (_) {}
    const r = field.getBoundingClientRect(), q = box(b);
    held = b; home = { b }; b.away = true; b.lab.style.visibility = 'hidden';
    Object.assign(lift.style, { display: 'grid', width: q.w + 'px', height: q.h + 'px', borderRadius: q.r + 'px', background: INK[b.ink][0], color: INK[b.ink][1] });
    lift.innerHTML = b.lab.innerHTML;
    sx.v = sx.to = r.left + q.x; sy.v = sy.to = r.top + q.y; sx.vel = sy.vel = 0;
    gx = e.clientX - sx.v; gy = e.clientY - sy.v;
    sc.to = still ? 1 : 1.06; drawLift(); wake(tick);
  };
  field.addEventListener('pointermove', e => {
    if (pending && !held) {
      const dx = e.clientX - pending.x, dy = e.clientY - pending.y;
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) { const b = pending.b; pending = null; startLift(b, { clientX: e.clientX - dx, clientY: e.clientY - dy, pointerId: e.pointerId }); }
      else if (Math.abs(dy) > 8) pending = null;
    }
    if (!held) return;
    sx.v = sx.to = e.clientX - gx; sy.v = sy.to = e.clientY - gy; drawLift();
  });
  const drop = () => { pending = null; if (!held) return; held = null; sc.to = 1; if (still) { sx.snap(); sy.snap(); } wake(tick); };
  field.addEventListener('pointerup', drop); field.addEventListener('pointercancel', drop);

  // the numbers roll up when the cluster first comes into view (RollingNumber, roughly)
  const rollNumbers = () => {
    const ease = spring(.95, .96);
    $$('b[data-v]', labels).forEach(el => {
      const v = el.dataset.v, m = v.match(/^([\d.]+)(.*)$/);
      if (!m || v.includes(':') || still) return;
      const end = parseFloat(m[1]), dec = (m[1].split('.')[1] || '').length, t0 = performance.now();
      const tick = now => {
        const t = Math.min(1, (now - t0) / 1400);
        el.textContent = (end * Math.min(1, ease(t))).toFixed(dec) + m[2];
        if (t < 1) requestAnimationFrame(tick); else el.textContent = v;
      };
      requestAnimationFrame(tick);
    });
  };
  const rollIO = new IntersectionObserver(es => { if (es[0].isIntersecting) { rollIO.disconnect(); rollNumbers(); } });
  rollIO.observe(field);
  }
  // fonts, images and the rise-ins all move things after load: re-measure whenever the
  // page's height changes, so the nav never names the wrong section
  sizePano(true); layoutNav(); measureSpy();
  if (current) requestAnimationFrame(() => moveTo(current));
  let remeasure = 0;
  new ResizeObserver(() => { cancelAnimationFrame(remeasure); remeasure = requestAnimationFrame(() => { sizePano(); layoutNav(); measureSpy(); spy(); measureTint(); tint(); }); }).observe(document.body);
})();
