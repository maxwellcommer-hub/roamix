// The plaque, in 3D, from a real order's print files (RMX-PGYT6J, "Ireland").
// assets/plaque-rmx.png is the assembled top surface of the two printed pieces — the red
// base with its rim and fins, and the white insert pressed into it — sampled every 0.25 mm
// straight from the 3MF triangles: R·G = height (16 bit over 0–20 mm), B = which piece is
// on top (255 red, 128 white, 0 outside the plaque). Plain WebGL2, no library.
(() => {
  const host = document.getElementById('plaque3d');
  if (!host) return;
  const cv = host.querySelector('canvas');
  const gl = cv.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl) { host.classList.add('nogl'); return; }
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const RES = 0.25, ZMAX = 20;                 // mm per sample, height scale
  const RED = [208, 30, 26], WHITE = [244, 241, 234], SHADOW = [11, 95, 156]; // spray red · white PLA · sky deep

  const vsSrc = `#version 300 es
    in vec3 p; in vec3 n; in float r;
    uniform mat4 mvp; uniform mat3 nm;
    out vec3 vn; out float vr; out float vz;
    void main(){ vn = nm * n; vr = r; vz = p.z; gl_Position = mvp * vec4(p, 1.0); }`;
  const fsSrc = `#version 300 es
    precision highp float;
    in vec3 vn; in float vr; in float vz;
    uniform vec3 red, white, shadow; uniform float flat_;
    out vec4 o;
    void main(){
      if (flat_ > .5) { o = vec4(shadow, 1.0); return; }
      vec3 N = normalize(vn);
      vec3 base = mix(white, red, step(.5, vr));
      vec3 L1 = normalize(vec3(-.45, .55, .75)), L2 = normalize(vec3(.6, -.2, .35));
      float d = max(dot(N, L1), 0.0) * .78 + max(dot(N, L2), 0.0) * .22;
      float sky = .5 + .5 * N.z;                      // a little light from above everywhere
      vec3 col = base * (.32 + .18 * sky + .62 * d);
      vec3 H = normalize(L1 + vec3(0.0, 0.0, 1.0));
      col += vec3(1.0) * pow(max(dot(N, H), 0.0), 40.0) * mix(.06, .16, step(.5, vr));
      o = vec4(min(col, vec3(1.0)), 1.0);
    }`;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(x); return x; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vsSrc)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fsSrc)); gl.linkProgram(prog);
  const U = n => gl.getUniformLocation(prog, n);

  // ── tiny matrix kit (column-major) ──
  const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
  const persp = (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); };
  const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
  const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); };
  const trans = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);

  let count = 0, shadowCount = 0, vao, svao, W = 0, H = 0;

  const build = px => {
    const { width: iw, height: ih, data } = px;
    const step = innerWidth < 700 ? 2 : 1;
    // one ring of floor-height samples all round, so every edge drops to the floor as a
    // wall (the map reaches right to the plaque's edge, so without it only the rounded
    // corners — where the map has empty samples — ever got sides)
    const sx = Math.floor((iw - 1) / step) + 1, sy = Math.floor((ih - 1) / step) + 1;
    const nx = sx + 2, ny = sy + 2;
    // the ring starts red: the base is sprayed on every side, so its walls are red top to bottom
    const z = new Float32Array(nx * ny), red = new Float32Array(nx * ny).fill(1), ins = new Uint8Array(nx * ny);
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = (((j - 1) * step) * iw + (i - 1) * step) * 4, b = data[k + 2];
      const v = j * nx + i;
      ins[v] = b > 0 ? 1 : 0;
      z[v] = b > 0 ? ((data[k] << 8) | data[k + 1]) / 65535 * ZMAX : 0;
      red[v] = b > 200 || b === 0 ? 1 : 0;
    }
    W = (nx - 1) * step * RES; H = (ny - 1) * step * RES;  // includes the floor ring
    const pos = new Float32Array(nx * ny * 3), nor = new Float32Array(nx * ny * 3), d = step * RES;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = j * nx + i;
      pos[v * 3] = i * d - W / 2; pos[v * 3 + 1] = H / 2 - j * d; pos[v * 3 + 2] = z[v];
      const zl = z[j * nx + Math.max(0, i - 1)], zr = z[j * nx + Math.min(nx - 1, i + 1)];
      const zu = z[Math.max(0, j - 1) * nx + i], zd = z[Math.min(ny - 1, j + 1) * nx + i];
      let gx = (zl - zr) / (2 * d), gy = (zd - zu) / (2 * d);
      const l = Math.hypot(gx, gy, 1); nor[v * 3] = gx / l; nor[v * 3 + 1] = gy / l; nor[v * 3 + 2] = 1 / l;
    }
    const idx = [], sidx = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, e = c + 1;
      const any = ins[a] | ins[b] | ins[c] | ins[e];
      if (!any) continue;
      idx.push(a, c, b, b, c, e);
      if (ins[a] & ins[b] & ins[c] & ins[e]) sidx.push(a, c, b, b, c, e);
    }
    const mk = (indices, flatZ) => {
      const va = gl.createVertexArray(); gl.bindVertexArray(va);
      const put = (arr, loc, size) => { const bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
      let P = pos;
      if (flatZ) { P = pos.slice(); for (let v = 2; v < P.length; v += 3) P[v] = 0; }
      put(P, gl.getAttribLocation(prog, 'p'), 3);
      put(nor, gl.getAttribLocation(prog, 'n'), 3);
      put(red, gl.getAttribLocation(prog, 'r'), 1);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);
      return va;
    };
    vao = mk(idx, false); count = idx.length;
    svao = mk(sidx, true); shadowCount = sidx.length;
  };

  // ── camera: drag to turn; at rest it sways, and a release springs home ──
  const home = { yaw: -.22, pitch: .55 };
  const cam = { yaw: home.yaw, pitch: home.pitch, vy: 0, vp: 0 };
  let dragging = false, lx = 0, ly = 0, t0 = performance.now(), lastT = 0, visible = false, raf = 0;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const draw = now => {
    raf = 0;
    const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const dt = Math.min(.05, (now - (lastT || now)) / 1000); lastT = now;
    let busy = dragging;
    if (!dragging) {
      // a spring back to home, plus a slow sway around it
      const sway = still ? 0 : Math.sin((now - t0) / 1000 * .55) * .12;
      const k = 38, c = 11;
      cam.vy += (-k * (cam.yaw - (home.yaw + sway)) - c * cam.vy) * dt; cam.yaw += cam.vy * dt;
      cam.vp += (-k * (cam.pitch - home.pitch) - c * cam.vp) * dt; cam.pitch += cam.vp * dt;
      busy = !still || Math.abs(cam.vy) + Math.abs(cam.vp) > .0005;
    }
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!count) return;
    gl.enable(gl.DEPTH_TEST); gl.useProgram(prog);
    const asp = w / h, fov = .5;
    // fit the plaque's diagonal in view at any aspect
    const R = Math.hypot(W, H) / 2, dist = R / Math.tan(fov / 2) * (asp < 1 ? .95 / asp : .86);
    const view = mul(trans(0, 4, -dist), mul(rotX(-cam.pitch), rotZ(cam.yaw)));
    const proj = persp(fov, asp, dist * .3, dist * 3);
    const mvp = mul(proj, view);
    const nm = new Float32Array([view[0], view[1], view[2], view[4], view[5], view[6], view[8], view[9], view[10]]);
    gl.uniformMatrix4fv(U('mvp'), false, mvp); gl.uniformMatrix3fv(U('nm'), false, nm);
    gl.uniform3fv(U('red'), RED.map(v => v / 255)); gl.uniform3fv(U('white'), WHITE.map(v => v / 255)); gl.uniform3fv(U('shadow'), SHADOW.map(v => v / 255));
    // the shadow: the plaque's own footprint, flat, in the field's deep ink, set down and to the right
    gl.uniform1f(U('flat_'), 1);
    gl.uniformMatrix4fv(U('mvp'), false, mul(proj, mul(view, trans(9, -11, -.5))));
    gl.bindVertexArray(svao); gl.drawElements(gl.TRIANGLES, shadowCount, gl.UNSIGNED_INT, 0);
    gl.uniform1f(U('flat_'), 0);
    gl.uniformMatrix4fv(U('mvp'), false, mvp);
    gl.bindVertexArray(vao); gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
    if (busy && visible) raf = requestAnimationFrame(draw);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };

  cv.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); host.classList.add('grab'); kick(); });
  cv.addEventListener('pointermove', e => {
    if (!dragging) return;
    cam.yaw += (e.clientX - lx) * .008; cam.pitch = clamp(cam.pitch - (e.clientY - ly) * .006, .25, 1.35);
    cam.yaw = clamp(cam.yaw, home.yaw - 1.1, home.yaw + 1.1);
    lx = e.clientX; ly = e.clientY; kick();
  });
  const release = () => { dragging = false; cam.vy = cam.vp = 0; host.classList.remove('grab'); kick(); };
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);
  addEventListener('resize', kick);

  // load only as the section comes near
  let loaded = false;
  new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    if (visible && !loaded) {
      loaded = true;
      const img = new Image(); img.decoding = 'async';
      img.onload = async () => {
        let bmp = img;
        try { bmp = await createImageBitmap(img, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }); } catch (_) {}
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true }); x.drawImage(bmp, 0, 0);
        build(x.getImageData(0, 0, c.width, c.height));
        host.classList.add('ready'); kick();
      };
      img.src = host.dataset.src;
    }
    if (visible) kick();
  }, { rootMargin: '300px 0px' }).observe(host);
})();
