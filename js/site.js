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
})();
