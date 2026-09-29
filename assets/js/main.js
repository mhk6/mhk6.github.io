// Dark-only site: year stamp, typing tagline, scroll-in reveals, and a
// falling/stacking Tetris background on the home page.
(function () {
  document.documentElement.classList.add("js");

  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Terminal-style typing on the tagline ----
  var t = document.querySelector("[data-type]");
  if (t) {
    var full = t.getAttribute("data-type") || t.textContent;
    if (reduce) {
      t.textContent = full;
    } else {
      t.textContent = "";
      var cur = document.createElement("span");
      cur.className = "type-cursor";
      t.appendChild(cur);
      var i = 0;
      (function step() {
        if (i < full.length) {
          cur.parentNode.insertBefore(document.createTextNode(full.charAt(i)), cur);
          i++;
          setTimeout(step, 38);
        } else {
          setTimeout(function () { if (cur.parentNode) cur.parentNode.removeChild(cur); }, 1600);
        }
      })();
    }
  }

  // ---- Reveal list rows as they scroll into view ----
  var els = document.querySelectorAll(".reveal");
  if (els.length) {
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("in"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      els.forEach(function (el) { io.observe(el); });
    }
  }

  // ---- Smooth page transition fallback ----
  // Chromium does cross-document View Transitions natively (see CSS). Browsers
  // without them ('onpageswap' absent) get a smooth fade-out on navigation.
  if (!reduce && !("onpageswap" in window)) {
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest("a");
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      if (a.origin !== location.origin) return;                 // external
      if (/^(#|mailto:|tel:)/.test(href)) return;               // in-page / mail / tel
      if (a.pathname === location.pathname && a.hash) return;    // same-page anchor
      e.preventDefault();
      document.documentElement.classList.add("pt-leaving");
      setTimeout(function () { window.location.href = a.href; }, 220);
    });
    // clear the fade if restored from bfcache
    window.addEventListener("pageshow", function () {
      document.documentElement.classList.remove("pt-leaving");
    });
  }

  // ---- Falling / stacking Tetris background (home page only) ----
  var canvas = document.getElementById("tetris-bg");
  if (canvas && !reduce) startTetris(canvas);

  function startTetris(canvas) {
    var ctx = canvas.getContext("2d");
    // Classic pieces (normalised coords) + muted retro colors that sit back on the dark bg.
    var SHAPES = [
      { c: "#5aa3a3", cells: [[0,0],[0,1],[0,2],[0,3]] }, // I
      { c: "#b0a24a", cells: [[0,0],[0,1],[1,0],[1,1]] }, // O
      { c: "#8a6bb0", cells: [[0,0],[0,1],[0,2],[1,1]] }, // T
      { c: "#6aa76a", cells: [[0,1],[0,2],[1,0],[1,1]] }, // S
      { c: "#b06a6a", cells: [[0,0],[0,1],[1,1],[1,2]] }, // Z
      { c: "#5f7fb0", cells: [[0,0],[1,0],[1,1],[1,2]] }, // J
      { c: "#b0824a", cells: [[0,2],[1,0],[1,1],[1,2]] }  // L
    ];

    var dpr, cell, cols, rows, grid, piece, boardAlpha, state, stateT, yOffset;
    var seed = 1;                              // deterministic-ish PRNG (no Math.random dependency vibe)
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

    function rot(cells) {
      // rotate 90deg: (r,c) -> (c, maxR - r), then normalise
      var maxR = 0;
      cells.forEach(function (p) { if (p[0] > maxR) maxR = p[0]; });
      var out = cells.map(function (p) { return [p[1], maxR - p[0]]; });
      var minR = Math.min.apply(null, out.map(function (p) { return p[0]; }));
      var minC = Math.min.apply(null, out.map(function (p) { return p[1]; }));
      return out.map(function (p) { return [p[0] - minR, p[1] - minC]; });
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth || window.innerWidth;
      var h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = Math.max(24, Math.round(w / 34));
      cols = Math.ceil(w / cell);
      rows = Math.floor(h / cell);            // whole rows only
      yOffset = h - rows * cell;              // push down so the bottom row sits flush at the viewport bottom
      grid = [];
      for (var r = 0; r < rows; r++) grid.push(new Array(cols).fill(null));
      boardAlpha = 1; state = "play"; stateT = 0;
      piece = null;
      spawn();
    }

    function spawn() {
      var s = SHAPES[(rnd() * SHAPES.length) | 0];
      var cells = s.cells;
      var turns = (rnd() * 4) | 0;
      for (var k = 0; k < turns; k++) cells = rot(cells);
      var wCells = Math.max.apply(null, cells.map(function (p) { return p[1]; })) + 1;
      var hCells = Math.max.apply(null, cells.map(function (p) { return p[0]; })) + 1;
      var left = (rnd() * (cols - wCells + 1)) | 0;

      // hard-drop landing row for the piece's top
      var target = rows - hCells;
      var byCol = {};
      cells.forEach(function (p) {
        var c = p[1];
        if (byCol[c] === undefined || p[0] > byCol[c]) byCol[c] = p[0]; // lowest cell per column
      });
      Object.keys(byCol).forEach(function (c) {
        var boardCol = left + (+c);
        var firstFilled = rows;
        for (var r = 0; r < rows; r++) { if (grid[r][boardCol]) { firstFilled = r; break; } }
        var maxTop = firstFilled - 1 - byCol[c];
        if (maxTop < target) target = maxTop;
      });

      piece = { cells: cells, color: s.c, left: left, targetTop: target, y: -hCells * cell, h: hCells };
    }

    function commit() {
      var top = piece.targetTop;
      var over = false;
      piece.cells.forEach(function (p) {
        var r = top + p[0], c = piece.left + p[1];
        if (r < 0) { over = true; return; }
        if (r >= 0 && r < rows) grid[r][c] = piece.color;
      });
      // clear full rows
      for (var r = rows - 1; r >= 0; r--) {
        var full = true;
        for (var c = 0; c < cols; c++) { if (!grid[r][c]) { full = false; break; } }
        if (full) { grid.splice(r, 1); grid.unshift(new Array(cols).fill(null)); r++; }
      }
      if (over || (grid[0].some(Boolean) || grid[1].some(Boolean))) {
        state = "clear"; stateT = 0;               // stack hit the top: fade out and restart
      } else {
        spawn();
      }
    }

    function roundRect(x, yy, w, h, rad) {
      ctx.beginPath();
      ctx.moveTo(x + rad, yy);
      ctx.arcTo(x + w, yy, x + w, yy + h, rad);
      ctx.arcTo(x + w, yy + h, x, yy + h, rad);
      ctx.arcTo(x, yy + h, x, yy, rad);
      ctx.arcTo(x, yy, x + w, yy, rad);
      ctx.closePath();
      ctx.fill();
    }

    function block(cx, cy, color) {
      ctx.fillStyle = color;
      roundRect(cx + 1.5, cy + 1.5, cell - 3, cell - 3, Math.max(2, cell * 0.14));
    }

    var last = 0;
    function frame(ts) {
      if (!last) last = ts;
      var dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;

      if (state === "play" && piece) {
        piece.y += cell * 15 * dt;                 // fall speed
        var targetY = piece.targetTop * cell;
        if (piece.y >= targetY) { piece.y = targetY; commit(); }
      } else if (state === "clear") {
        stateT += dt;
        boardAlpha = Math.max(0, 1 - stateT / 0.7);
        if (stateT >= 0.7) {
          for (var r = 0; r < rows; r++) grid[r].fill(null);
          boardAlpha = 1; state = "play"; spawn();
        }
      }

      // draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.5 * boardAlpha;
      for (var r = 0; r < rows; r++)
        for (var c = 0; c < cols; c++)
          if (grid[r][c]) block(c * cell, yOffset + r * cell, grid[r][c]);

      if (state === "play" && piece) {
        ctx.globalAlpha = 0.62;
        piece.cells.forEach(function (p) {
          block((piece.left + p[1]) * cell, yOffset + piece.y + p[0] * cell, piece.color);
        });
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }

    resize();
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt); rt = setTimeout(resize, 200);
    });
    requestAnimationFrame(frame);
  }
})();
