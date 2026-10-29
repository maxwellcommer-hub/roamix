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

  // ── Nav: one bar at the top; pinches into three pills once you scroll ───────────────
  const nav = $('#nav');
  const foot = $('.foot');
  const onScrollNav = () => {
    nav.classList.toggle('split', scrollY > 40);
    nav.classList.toggle('onink', foot.getBoundingClientRect().top < 40);
  };
  addEventListener('scroll', onScrollNav, { passive: true }); onScrollNav();

  const links = $$('.nav .links a'), pick = $('.nav .pick'), blobs = pick ? $$('b', pick) : [];
  let current = null;
  const moveTo = a => {
    if (!a) { pick.classList.remove('live'); links.forEach(l => l.classList.remove('on')); return; }
    const box = a.parentElement.getBoundingClientRect(), r = a.getBoundingClientRect();
    blobs.forEach(b => { b.style.transform = `translateX(${r.left - box.left}px)`; b.style.width = `${r.width}px`; });
    pick.classList.add('live');
    links.forEach(l => l.classList.toggle('on', l === a));
  };
  links.forEach(a => {
    a.addEventListener('pointerenter', () => moveTo(a));
    a.addEventListener('focus', () => moveTo(a));
  });
  $('.nav .links')?.addEventListener('pointerleave', () => moveTo(current));
  const sections = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
  const spy = () => {
    const y = innerHeight * .4; let hit = null;
    sections.forEach((s, i) => { const r = s.getBoundingClientRect(); if (r.top < y && r.bottom > y) hit = links[i]; });
    if (hit !== current) { current = hit; if (!$('.nav .links:hover')) moveTo(current); }
  };
  addEventListener('scroll', spy, { passive: true });

  // ── Goo buttons know their own width, so the droplets bud off the ends ──────────────
  $$('.gbtn').forEach(b => { const set = () => b.style.setProperty('--w', b.offsetWidth + 'px'); set(); new ResizeObserver(set).observe(b); });

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
  setDraw(0);
  if (document.readyState === 'complete') startHero(); else addEventListener('load', startHero);
  // fonts can land after load on a slow line; don't hold the page for them
  setTimeout(() => { if (!hero.classList.contains('in')) startHero(); }, 2500);

  // ── Tour: vertical scroll drives the strip sideways ─────────────────────────────────
  const pano = $('#tour'), strip = $('#strip'), plates = $$('.plate', strip);
  const ticks = $('#ticks'), num = $('#pano-n');
  plates.forEach(() => ticks.append(document.createElement('i')));
  const tickEls = $$('i', ticks);
  let travel = 0;
  const sizePano = () => {
    travel = Math.max(0, strip.scrollWidth - innerWidth);
    pano.style.height = `${innerHeight + travel}px`;
    panoScroll();
  };
  const panoScroll = () => {
    const r = pano.getBoundingClientRect();
    const f = travel ? Math.min(1, Math.max(0, -r.top / travel)) : 0;
    strip.style.transform = `translate3d(${-f * travel}px,0,0)`;
    nav.classList.toggle('away', r.top <= 1 && r.bottom >= innerHeight - 1);
    // which plate is centred, and which have come on screen
    const mid = innerWidth / 2; let on = 0;
    plates.forEach((p, i) => {
      const b = p.getBoundingClientRect();
      if (b.left < innerWidth * .85 && b.right > 0 && r.top < innerHeight * .5) p.classList.add('seen');
      if (b.left <= mid) on = i;
    });
    tickEls.forEach((t, i) => t.classList.toggle('on', i === on));
    num.textContent = String(on + 1).padStart(2, '0');
  };
  addEventListener('scroll', panoScroll, { passive: true });
  addEventListener('resize', sizePano);
  $$('img', strip).forEach(img => img.complete || img.addEventListener('load', sizePano, { once: true }));
  sizePano();
  if (still) plates.forEach(p => p.classList.add('seen'));

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

  // ── Every mile, counted: goo bubbles. Same-ink bubbles fuse when they meet; inks never
  //    mix (one goo layer per ink). Drag one and the others make room. ───────────────────
  const field = $('#bubbles');
  const INK = { verm: ['#E8401E', '#F7F4ED'], sky: ['#1180CE', '#F7F4ED'], chrome: ['#F5B301', '#16150F'], palm: ['#12795A', '#F7F4ED'] };
  const data = [
    ['14', 'trips', 'verm', 1.05], ['23.4k', 'miles', 'sky', 1.25], ['112', 'places', 'palm', 1.0],
    ['21', 'cities', 'palm', .82], ['64%', 'driven', 'sky', .95], ['31%', 'flown', 'verm', .9],
    ['0.9×', 'around the earth', 'chrome', 1.02], ['9:40', 'usual departure', 'chrome', .92],
  ];
  const labels = $('.labels', field);
  const B = data.map(([v, l, ink, s], i) => {
    const el = document.createElement('i'); el.style.background = INK[ink][0];
    $(`.ink[data-ink="${ink}"]`, field).append(el);
    const lab = document.createElement('div'); lab.style.color = INK[ink][1];
    lab.innerHTML = `<div><b data-v="${v}">${v}</b><small>${l}</small></div>`;
    labels.append(lab);
    const a = i / data.length * Math.PI * 2;
    return { el, lab, s, ink, x: .5 + Math.cos(a) * .32, y: .5 + Math.sin(a) * .32, vx: 0, vy: 0, w: 0, h: 0, ph: Math.random() * 6.28, held: false };
  });
  let FW = 0, FH = 0;
  const sizeBubbles = () => {
    FW = field.clientWidth; FH = field.clientHeight;
    const base = Math.min(FW, FH) * .19;
    B.forEach(b => { b.h = base * b.s; b.w = b.h * 1.55; b.el.style.width = b.lab.style.width = b.w + 'px'; b.el.style.height = b.lab.style.height = b.h + 'px'; });
  };
  new ResizeObserver(sizeBubbles).observe(field); sizeBubbles();

  // pointer drag
  let held = null, px = 0, py = 0;
  const local = e => { const r = field.getBoundingClientRect(); return [(e.clientX - r.left) / FW, (e.clientY - r.top) / FH]; };
  field.addEventListener('pointerdown', e => {
    const [x, y] = local(e);
    held = B.find(b => Math.abs(x - b.x) * FW < b.w / 2 && Math.abs(y - b.y) * FH < b.h / 2) || null;
    if (held) { field.setPointerCapture(e.pointerId); held.held = true; [px, py] = [x, y]; e.preventDefault(); }
  });
  field.addEventListener('pointermove', e => {
    if (!held) return; const [x, y] = local(e);
    held.vx = (x - px); held.vy = (y - py); held.x = x; held.y = y; [px, py] = [x, y];
  });
  const drop = () => { if (held) { held.held = false; held.vx *= 6; held.vy *= 6; held = null; } };
  field.addEventListener('pointerup', drop); field.addEventListener('pointercancel', drop);

  let live = false, last = 0;
  const step = now => {
    const dt = Math.min(32, now - (last || now)) / 16.67; last = now;
    B.forEach((b, i) => {
      if (!b.held) {
        // a slow drift round a home position, pulled back to the middle
        b.ph += .006 * dt;
        b.vx += ((.5 - b.x) * .0005 + Math.cos(b.ph + i) * .00012) * dt;
        b.vy += ((.5 - b.y) * .0005 + Math.sin(b.ph * 1.3 + i) * .00012) * dt;
      }
      // keep apart. Different inks keep a hair of ground between them (inks never mix);
      // the same ink is let graze, and that is when the goo necks two bubbles into one.
      B.forEach((o, j) => {
        if (j <= i) return;
        const same = b.ink === o.ink;
        const dx = (o.x - b.x) * FW, dy = (o.y - b.y) * FH;
        const gap = same ? -b.h * .18 : 10;
        const needX = (b.w + o.w) / 2 + gap, needY = (b.h + o.h) / 2 + gap;
        const ox = needX - Math.abs(dx), oy = needY - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          const k = .06 * dt;
          if (ox / needX < oy / needY) { const f = Math.sign(dx || (i - j)) * ox * k / FW; if (!b.held) b.vx -= f; if (!o.held) o.vx += f; }
          else { const f = Math.sign(dy || (i - j)) * oy * k / FH; if (!b.held) b.vy -= f; if (!o.held) o.vy += f; }
        } else if (same) {
          // same ink drifts back toward each other, gently
          const d = Math.hypot(dx, dy) || 1, f = .00004 * dt;
          if (!b.held) { b.vx += dx / d * f; b.vy += dy / d * f; }
          if (!o.held) { o.vx -= dx / d * f; o.vy -= dy / d * f; }
        }
      });
    });
    B.forEach(b => {
      if (!b.held) {
        b.vx *= Math.pow(.9, dt); b.vy *= Math.pow(.9, dt);
        b.x += b.vx * dt; b.y += b.vy * dt;
        const mx = b.w / 2 / FW, my = b.h / 2 / FH;
        if (b.x < mx) { b.x = mx; b.vx *= -.5; } if (b.x > 1 - mx) { b.x = 1 - mx; b.vx *= -.5; }
        if (b.y < my) { b.y = my; b.vy *= -.5; } if (b.y > 1 - my) { b.y = 1 - my; b.vy *= -.5; }
      }
      const t = `translate3d(${b.x * FW - b.w / 2}px,${b.y * FH - b.h / 2}px,0)`;
      b.el.style.transform = t; b.lab.style.transform = t;
    });
    if (live) requestAnimationFrame(step);
  };
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
  let rolled = false;
  new IntersectionObserver(es => {
    live = es[0].isIntersecting && !still;
    if (live) { last = 0; requestAnimationFrame(step); }
    if (es[0].isIntersecting && !rolled) { rolled = true; rollNumbers(); }
  }).observe(field);
  // settle them once so a still page still shows a tidy cluster
  for (let k = 0; k < 400; k++) step(k * 16.67);
  last = 0;
})();
