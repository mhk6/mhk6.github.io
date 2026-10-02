/* Rolling FSK scope — message, carrier, transmitted signal, scrolling continuously.

   Perf notes: one canvas (not three), ring buffers with a moving head instead of
   shifting arrays, and zero DOM access inside the animation frame. Everything the
   loop needs is captured once at startup.

   Scale is deliberately exaggerated. A real link is ~10,000 carrier cycles per bit
   and deviates a tiny fraction of a percent of 2.4 GHz; drawn honestly nothing
   would be visible. */
(function () {
  var root = document.querySelector("[data-rfviz]");
  if (!root) return;
  var cv = root.querySelector("canvas");
  if (!cv) return;
  var ctx = cv.getContext("2d");

  var COL = {
    msg: "#f0b429",   // the bits going in
    car: "#6f7a93",   // the bare carrier
    mod: "#7d97ff",   // what leaves the antenna
    grid: "#2b2e37",
    axis: "#3a3e49"
  };
  var BANDS = [
    { k: "msg", label: "MESSAGE", sub: "the bits", c: COL.msg, w: 2 },
    { k: "car", label: "CARRIER", sub: "unmodulated", c: COL.car, w: 1.2 },
    { k: "mod", label: "TRANSMITTED", sub: "message on carrier", c: COL.mod, w: 1.5 }
  ];

  // fixed, chosen to be readable: ~7 carrier cycles per bit, wide deviation
  var FC = 0.042;      // carrier cycles per pixel
  var BR = 0.006;      // bits per pixel
  var DEV = 0.38;      // fraction of carrier
  var STEP = 2;        // pixels advanced per frame

  var W = 0, H = 0, bandH = 0, dpr = 1;
  var buf = { msg: null, car: null, mod: null }, head = 0;
  var phaseC = 0, phaseM = 0, bitIndex = 0, bitPhase = 0, curBit = 1;
  var edges = null;    // bit-boundary pixel flags, same ring
  var raf = null;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function bitAt(n) {
    var x = Math.sin(n * 12.9898 + 4.1414) * 43758.5453;
    return (x - Math.floor(x)) > 0.5 ? 1 : -1;
  }

  function size() {
    var r = cv.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    bandH = H / 3;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buf.msg = new Float32Array(W); buf.car = new Float32Array(W); buf.mod = new Float32Array(W);
    edges = new Uint8Array(W);
    head = 0;
  }

  function advance(n) {
    var bitLen = 1 / BR;
    for (var s = 0; s < n; s++) {
      var edge = 0;
      bitPhase += 1;
      if (bitPhase >= bitLen) { bitPhase -= bitLen; bitIndex++; curBit = bitAt(bitIndex); edge = 1; }
      phaseC += 2 * Math.PI * FC;
      phaseM += 2 * Math.PI * FC * (1 + curBit * DEV);
      if (phaseC > 1e7) { phaseC -= 1e7; phaseM -= 1e7; }
      buf.msg[head] = curBit;
      buf.car[head] = Math.cos(phaseC);
      buf.mod[head] = Math.cos(phaseM);
      edges[head] = edge;
      head = (head + 1) % W;
    }
  }

  function paint() {
    ctx.clearRect(0, 0, W, H);

    // bit boundaries, drawn once behind everything so all three bands line up
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x < W; x++) {
      if (edges[(head + x) % W]) { ctx.moveTo(x + 0.5, 4); ctx.lineTo(x + 0.5, H - 4); }
    }
    ctx.stroke();

    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = "top";

    for (var b = 0; b < 3; b++) {
      var band = BANDS[b], top = b * bandH, mid = top + bandH / 2, amp = bandH * 0.3;

      ctx.strokeStyle = COL.axis; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, Math.round(mid) + 0.5); ctx.lineTo(W, Math.round(mid) + 0.5); ctx.stroke();

      ctx.strokeStyle = band.c; ctx.lineWidth = band.w;
      ctx.beginPath();
      var a = buf[band.k];
      for (var i = 0; i < W; i++) {
        var y = mid - a[(head + i) % W] * amp;
        i ? ctx.lineTo(i, y) : ctx.moveTo(i, y);
      }
      ctx.stroke();

      ctx.fillStyle = band.c;
      ctx.fillText(band.label, 4, top + 4);
      ctx.fillStyle = COL.car;
      ctx.fillText(band.sub, 6 + ctx.measureText(band.label).width + 6, top + 4);
    }
  }

  function frame() { advance(STEP); paint(); raf = requestAnimationFrame(frame); }

  var btn = root.querySelector("[data-run]");
  function run(on) {
    if (on && !raf) raf = requestAnimationFrame(frame);
    else if (!on && raf) { cancelAnimationFrame(raf); raf = null; }
    if (btn) btn.textContent = raf ? "pause" : "run";
  }
  if (btn) btn.addEventListener("click", function () { run(!raf); });

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { var r = !!raf; run(false); size(); advance(W); paint(); run(r); }, 150);
  });

  size();
  advance(W);
  paint();
  if (!reduced) run(true); else if (btn) btn.textContent = "run";
})();
