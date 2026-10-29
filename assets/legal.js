// The legal pages' one extra: an "On this page" list built from the document's own headings,
// which follows you down the page. (Nav, goo and footer come from site.js.)
(() => {
  const head = document.querySelector('.doc-head');
  requestAnimationFrame(() => head?.classList.add('in'));

  const doc = document.getElementById('doc'), toc = document.getElementById('toc');
  if (!doc || !toc) return;
  const hs = [...doc.querySelectorAll('h2')];
  if (hs.length < 3) { toc.closest('.toc').classList.add('none'); return; }
  const slug = t => t.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const items = hs.map(h => {
    if (!h.id) h.id = slug(h.textContent);
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = '#' + h.id; a.textContent = h.textContent;
    li.append(a); toc.append(li);
    return a;
  });
  // the heading you're reading under is the one most recently passed
  let tops = [];
  const measure = () => { tops = hs.map(h => h.getBoundingClientRect().top + scrollY); };
  const mark = () => {
    const y = scrollY + 140; let on = -1;
    tops.forEach((t, i) => { if (t <= y) on = i; });
    items.forEach((a, i) => a.classList.toggle('on', i === on));
  };
  measure(); mark();
  let q = false;
  addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; mark(); }); } }, { passive: true });
  new ResizeObserver(() => { measure(); mark(); }).observe(document.body);
  // the TOC links glide too (site.js wires a[href^="#"] that existed at load; these are new)
  items.forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const t = document.getElementById(a.hash.slice(1));
    const y = t.getBoundingClientRect().top + scrollY - 96;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) scrollTo(0, y); else scrollTo({ top: y, behavior: 'smooth' });
    history.replaceState(null, '', a.hash);
  }));
})();
