/* Z1N site: mobile menu, and the Field drawing (each Key a line, each point what it wrote). */
(function () {
  "use strict";

  // ── Mobile menu ─────────────────────────────────────────────
  var menu = document.getElementById("zMenu");
  var nav = document.getElementById("zNav");
  if (menu && nav) {
    menu.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      menu.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // ── Learn the Field sub-navigation: keep the current guide in view on small screens ──
  var subCur = document.querySelector(".z-subnav a[aria-current]");
  if (subCur && subCur.parentNode.scrollWidth > subCur.parentNode.clientWidth) {
    subCur.parentNode.scrollLeft = subCur.offsetLeft - subCur.parentNode.offsetLeft - 16;
  }

  // ── Copy buttons (contract addresses) ──────────────────────
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy]");
    if (!b || !navigator.clipboard) return;
    navigator.clipboard.writeText(b.getAttribute("data-copy")).then(function () {
      var t = b.textContent;
      b.textContent = "copied";
      b.classList.add("done");
      setTimeout(function () { b.textContent = t; b.classList.remove("done"); }, 1400);
    }).catch(function () {});
  });

  // ── The Field ───────────────────────────────────────────────
  // Signals per Key in 8-epoch bins, epoch 0 to 246 (from the ledger snapshot at epoch 246).
  var FIELD = {
    upTo: 246,
    keys: [
      { id: 0,  mint: 0,   g: "△☷↻∵⋮☰△", b: [3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
      { id: 1,  mint: 1,   g: "☰✱○⊕☰π∴", b: [13,15,12,14,14,14,12,14,10,10,8,8,12,16,16,10,12,10,9,7,0,5,5,9,4,3,9,2,10,4,2] },
      { id: 2,  mint: 1,   g: "π⊗⋮○π∵∴", b: [14,16,14,14,14,14,14,14,10,10,8,8,12,16,16,7,9,10,10,8,0,6,6,13,7,4,10,2,12,4,2] },
      { id: 3,  mint: 1,   g: "○⊗○✱⚑☰●", b: [14,16,13,13,14,14,11,11,9,9,5,4,4,9,9,8,6,9,10,8,0,4,6,14,5,3,10,2,9,3,1] },
      { id: 4,  mint: 1,   g: "⊥●△↔⊗π⚑", b: [12,16,14,14,14,14,14,14,7,10,8,7,5,12,16,4,9,9,8,8,0,6,6,12,7,2,9,2,11,4,1] },
      { id: 5,  mint: 1,   g: "◊≡⋮⊕○☰✱", b: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
      { id: 6,  mint: 18,  g: "⊥↔∵⊥∞⊕⋮", b: [0,0,6,7,14,14,12,9,8,15,13,16,16,11,15,14,10,15,14,12,13,12,14,15,15,16,16,16,14,16,13] },
      { id: 7,  mint: 18,  g: "⚑∴◊□△⋮≡", b: [0,0,8,16,16,16,16,14,9,9,4,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0] },
      { id: 8,  mint: 18,  g: "∞↻↔⊗⚑⊕⚑", b: [0,0,4,6,15,10,11,9,8,15,15,15,16,16,15,14,12,15,8,6,14,14,4,4,0,0,14,15,14,11,14] },
      { id: 9,  mint: 18,  g: "⋮↻⋮○✱⋮☰", b: [0,0,8,16,16,14,15,15,10,14,13,16,16,11,16,11,8,14,14,15,14,12,14,15,15,15,16,15,12,15,8] },
      { id: 10, mint: 208, g: "π≡☰◇⚑✱✱", b: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,1,5,2,0] }
    ]
  };

  var NS = "http://www.w3.org/2000/svg";
  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function drawField(host) {
    var W = 560, rowH = 30, top = 8, left = 44, right = 12;
    var rows = FIELD.keys.length + 1;
    var H = top + rows * rowH + 34;
    var bins = FIELD.keys[0].b.length;
    var span = W - left - right;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Every Key in the Field drawn as a line from the epoch it arrived to now; each point is how much it wrote in that stretch of eight epochs." });
    function x(bin) { return left + (bin + 0.5) / bins * span; }

    FIELD.keys.forEach(function (k, i) {
      var y = top + i * rowH + rowH / 2;
      var start = Math.floor(k.mint / 8);
      svg.appendChild(el("text", { x: 0, y: y + 4, "font-size": 11, fill: "#84909D", "font-family": "Geist Mono, monospace" })).textContent = "K" + k.id;
      svg.appendChild(el("line", { x1: x(start), x2: W - right, y1: y, y2: y, stroke: "#2A3441", "stroke-width": 1 }));
      k.b.forEach(function (n, j) {
        if (!n) return;
        var last = j === bins - 1;
        svg.appendChild(el("circle", {
          cx: x(j), cy: y, r: (1.4 + (n / 16) * 4.2).toFixed(2),
          fill: last ? "#5EE8A0" : "#EDF1F5",
          "fill-opacity": (0.28 + 0.72 * Math.min(1, n / 16)).toFixed(2)
        }));
      });
    });

    // The next line: yours
    var yy = top + FIELD.keys.length * rowH + rowH / 2;
    svg.appendChild(el("text", { x: 0, y: yy + 4, "font-size": 11, fill: "#FFD556", "font-family": "Geist Mono, monospace" })).textContent = "K11";
    svg.appendChild(el("line", { x1: x(bins - 1), x2: W - right, y1: yy, y2: yy, stroke: "#FFD556", "stroke-width": 1.5, "stroke-dasharray": "3 4" }));
    svg.appendChild(el("circle", { cx: x(bins - 1), cy: yy, r: 4, fill: "none", stroke: "#FFD556", "stroke-width": 1.5 }));

    // Axis
    var ay = H - 14;
    svg.appendChild(el("line", { x1: left, x2: W - right, y1: ay - 14, y2: ay - 14, stroke: "#1F2731" }));
    [["epoch 0", left, "start"], ["120", left + span / 2, "middle"], ["246, now", W - right, "end"]].forEach(function (t) {
      svg.appendChild(el("text", { x: t[1], y: ay, "font-size": 11, fill: "#84909D", "text-anchor": t[2], "font-family": "Geist Mono, monospace" })).textContent = t[0];
    });

    host.innerHTML = "";
    host.appendChild(svg);
  }

  var fieldHost = document.getElementById("zField");
  if (fieldHost) drawField(fieldHost);

  // ── Bonds between Keys ──────────────────────────────────────
  // Artefacts per pair of Keys: [keyA, keyB, active, released, pending] (ledger snapshot at epoch 246).
  var BONDS = [
    [1,2,2,0,0],[1,3,9,6,0],[1,4,4,3,0],[1,6,0,4,0],[1,8,1,2,0],[1,10,1,0,0],
    [2,3,1,0,0],[2,4,5,0,0],[2,8,1,0,0],[3,4,20,0,0],[3,6,3,0,0],[3,8,2,0,0],
    [3,10,1,0,0],[4,9,4,0,0],[5,8,0,0,1],[6,7,4,0,0],[6,8,13,0,0],[6,9,17,0,0],
    [8,9,33,1,0],[9,10,1,0,0]
  ];

  function drawBonds(host) {
    var S = 420, c = S / 2, R = 168, n = 11;
    var svg = el("svg", { viewBox: "0 0 " + S + " " + S, role: "img", "aria-label": "Bonds between the eleven Keys. Each line is a pair of Keys that have exchanged artefacts; thicker lines mean more bonds." });
    function pos(i) { var a = -Math.PI / 2 + i / n * Math.PI * 2; return [c + R * Math.cos(a), c + R * Math.sin(a)]; }
    var deg = {};
    BONDS.forEach(function (b) {
      var t = b[2] + b[3] + b[4];
      deg[b[0]] = (deg[b[0]] || 0) + t; deg[b[1]] = (deg[b[1]] || 0) + t;
    });
    // released and pending first, active on top
    BONDS.forEach(function (b) {
      var p = pos(b[0]), q = pos(b[1]);
      if (b[3] && !b[2]) svg.appendChild(el("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: "#84909D", "stroke-width": 1.2, "stroke-dasharray": "2 5", "stroke-linecap": "round" }));
      if (b[4]) svg.appendChild(el("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: "#FFD556", "stroke-width": 1.4, "stroke-dasharray": "4 5" }));
    });
    BONDS.forEach(function (b) {
      if (!b[2]) return;
      var p = pos(b[0]), q = pos(b[1]);
      // a gentle curve towards the centre
      var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      var cx = mx + (c - mx) * 0.35, cy = my + (c - my) * 0.35;
      svg.appendChild(el("path", {
        d: "M" + p[0].toFixed(1) + " " + p[1].toFixed(1) + " Q" + cx.toFixed(1) + " " + cy.toFixed(1) + " " + q[0].toFixed(1) + " " + q[1].toFixed(1),
        fill: "none", stroke: "#5EE8A0", "stroke-linecap": "round",
        "stroke-width": (1 + Math.sqrt(b[2]) * 1.15).toFixed(2),
        "stroke-opacity": (0.35 + 0.6 * Math.min(1, b[2] / 20)).toFixed(2)
      }));
    });
    for (var i = 0; i < n; i++) {
      var p = pos(i), d = deg[i] || 0;
      var r = 15 + Math.min(9, Math.sqrt(d) * 1.2);
      svg.appendChild(el("circle", { cx: p[0], cy: p[1], r: r.toFixed(1), fill: "#11161D", stroke: d ? "#EDF1F5" : "#2A3441", "stroke-width": 1.4 }));
      var t = svg.appendChild(el("text", { x: p[0], y: p[1] + 4, "text-anchor": "middle", "font-size": 12, fill: d ? "#EDF1F5" : "#84909D", "font-family": "Geist Mono, monospace" }));
      t.textContent = "K" + i;
    }
    host.innerHTML = "";
    host.appendChild(svg);
  }

  var bondsHost = document.getElementById("zBonds");
  if (bondsHost) drawBonds(bondsHost);
})();
