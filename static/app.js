(() => {
  "use strict";

  // Change this symbol if your salary data is in another currency (e.g. "₹").
  const CURRENCY = "$";
  const X_DOMAIN = [0, 15];
  const W = 640, H = 400, M = { top: 28, right: 20, bottom: 44, left: 64 };

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => CURRENCY + Math.round(n).toLocaleString("en-US");
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  };

  const ui = {
    num: $("years-number"), range: $("years-range"),
    salary: $("salary"), rangeText: $("range"),
    notice: $("notice"), error: $("error"),
  };

  let info = null, chart = null, years = 5, timer = null, reqId = 0;

  // ---------- chart ----------
  function buildChart() {
    const host = $("chart");
    host.innerHTML = "";
    const ys = info.points.map((p) => p.y).concat(info.line.map((p) => p.y));
    const yMax = Math.ceil((Math.max(...ys) * 1.12) / 20000) * 20000;
    const sx = (x) => M.left + ((x - X_DOMAIN[0]) / (X_DOMAIN[1] - X_DOMAIN[0])) * (W - M.left - M.right);
    const sy = (y) => H - M.bottom - (y / yMax) * (H - M.top - M.bottom);
    const invX = (px) => X_DOMAIN[0] + ((px - M.left) / (W - M.left - M.right)) * (X_DOMAIN[1] - X_DOMAIN[0]);

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}` }, host);

    for (let v = 0; v <= yMax; v += 20000) {
      el("line", { class: "grid", x1: M.left, x2: W - M.right, y1: sy(v), y2: sy(v) }, svg);
      const t = el("text", { x: M.left - 10, y: sy(v) + 4, "text-anchor": "end" }, svg);
      t.textContent = v === 0 ? "0" : CURRENCY + v / 1000 + "k";
    }
    for (let v = 0; v <= X_DOMAIN[1]; v += 3) {
      const t = el("text", { x: sx(v), y: H - M.bottom + 22, "text-anchor": "middle" }, svg);
      t.textContent = v;
    }
    const xl = el("text", { x: (M.left + W - M.right) / 2, y: H - 6, "text-anchor": "middle" }, svg);
    xl.textContent = "Years of experience";

    info.points.forEach((p) => el("circle", { class: "pt", cx: sx(p.x), cy: sy(p.y), r: 4.5 }, svg));

    // Trend line, extended across the full x-axis using the end segments.
    const L = info.line, n = L.length;
    const slopeA = (L[1].y - L[0].y) / (L[1].x - L[0].x);
    const slopeB = (L[n - 1].y - L[n - 2].y) / (L[n - 1].x - L[n - 2].x);
    const lineAt = (x) => {
      if (x <= L[0].x) return L[0].y + slopeA * (x - L[0].x);
      if (x >= L[n - 1].x) return L[n - 1].y + slopeB * (x - L[n - 1].x);
      for (let i = 1; i < n; i++) {
        if (x <= L[i].x) {
          const t = (x - L[i - 1].x) / (L[i].x - L[i - 1].x);
          return L[i - 1].y + t * (L[i].y - L[i - 1].y);
        }
      }
    };
    const steps = 60;
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const x = X_DOMAIN[0] + (i / steps) * (X_DOMAIN[1] - X_DOMAIN[0]);
      d += (i ? "L" : "M") + sx(x).toFixed(1) + " " + sy(Math.max(lineAt(x), 0)).toFixed(1);
    }
    el("path", { class: "trend", d }, svg);

    const guide = el("line", { class: "guide" }, svg);
    const tagG = el("g", {}, svg);
    const tagBg = el("rect", { class: "tag", rx: 8, height: 26 }, tagG);
    const tagTx = el("text", { class: "tag-text", "text-anchor": "middle" }, tagG);
    const marker = el("circle", { class: "marker", r: 9, tabindex: 0, role: "slider",
      "aria-label": "Years of experience", "aria-valuemin": 0, "aria-valuemax": X_DOMAIN[1] }, svg);

    const toX = (evt) => {
      const r = svg.getBoundingClientRect();
      return invX(((evt.clientX - r.left) / r.width) * W);
    };
    let dragging = false;
    svg.addEventListener("pointerdown", (e) => { dragging = true; svg.setPointerCapture(e.pointerId); setYears(toX(e)); });
    svg.addEventListener("pointermove", (e) => { if (dragging) setYears(toX(e)); });
    svg.addEventListener("pointerup", () => (dragging = false));
    svg.addEventListener("pointercancel", () => (dragging = false));
    marker.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 1 : 0.5;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") { setYears(years + step); e.preventDefault(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") { setYears(years - step); e.preventDefault(); }
    });

    chart = {
      move(x, salary) {
        const cx = sx(Math.min(x, X_DOMAIN[1])), cy = sy(Math.max(salary, 0));
        marker.setAttribute("cx", cx); marker.setAttribute("cy", cy);
        marker.setAttribute("aria-valuenow", x);
        guide.setAttribute("x1", cx); guide.setAttribute("x2", cx);
        guide.setAttribute("y1", cy); guide.setAttribute("y2", H - M.bottom);
        const label = fmt(salary);
        tagTx.textContent = label;
        const w = label.length * 8.5 + 20;
        const tx = Math.min(Math.max(cx, M.left + w / 2), W - M.right - w / 2);
        const ty = cy - 44 < M.top - 10 ? cy + 18 : cy - 44;
        tagBg.setAttribute("width", w); tagBg.setAttribute("x", tx - w / 2); tagBg.setAttribute("y", ty);
        tagTx.setAttribute("x", tx); tagTx.setAttribute("y", ty + 18);
      },
      lineAt,
    };
  }

  // ---------- state ----------
  function clamp(v) { return Math.min(Math.max(v, 0), 50); }

  function setYears(v, { fromInput = false } = {}) {
    if (Number.isNaN(v)) return;
    years = clamp(Math.round(v * 10) / 10);
    if (!fromInput) ui.num.value = years;
    ui.range.value = Math.min(years, +ui.range.max);
    document.querySelectorAll(".presets button").forEach((b) =>
      b.setAttribute("aria-pressed", String(+b.dataset.years === years)));
    if (chart) chart.move(years, chart.lineAt(years));
    clearTimeout(timer);
    timer = setTimeout(predict, 80);
  }

  async function predict() {
    const id = ++reqId;
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ years }),
      });
      const data = await res.json();
      if (id !== reqId) return; // a newer request superseded this one
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      ui.error.hidden = true;
      ui.salary.textContent = fmt(data.salary);
      ui.rangeText.textContent = `Likely range: ${fmt(data.low)} – ${fmt(data.high)}`;
      if (chart) chart.move(years, data.salary);
      if (data.outside_range) {
        ui.notice.hidden = false;
        ui.notice.textContent = `The data covers ${data.data_range[0]}–${data.data_range[1]} years. Estimates outside that range are less reliable.`;
      } else ui.notice.hidden = true;
    } catch (err) {
      if (id !== reqId) return;
      ui.error.hidden = false;
      ui.error.textContent = err.message.includes("fetch")
        ? "Can't reach the server. Check that app.py is still running."
        : err.message;
    }
  }

  // ---------- events ----------
  ui.num.addEventListener("input", () => {
    const v = parseFloat(ui.num.value);
    if (ui.num.value === "" || Number.isNaN(v) || v < 0 || v > 50) {
      ui.error.hidden = false;
      ui.error.textContent = "Enter a number between 0 and 50.";
      return;
    }
    ui.error.hidden = true;
    setYears(v, { fromInput: true });
  });
  ui.num.addEventListener("blur", () => { ui.num.value = years; ui.error.hidden = true; });
  ui.range.addEventListener("input", () => setYears(parseFloat(ui.range.value)));
  $("inc").addEventListener("click", () => setYears(years + 0.5));
  $("dec").addEventListener("click", () => setYears(years - 0.5));
  document.querySelectorAll(".presets button").forEach((b) =>
    b.addEventListener("click", () => setYears(+b.dataset.years)));

  // ---------- init ----------
  async function init() {
    try {
      info = await (await fetch("/api/model-info")).json();
      $("s-name").textContent = info.name;
      $("s-n").textContent = info.n_samples;
      $("s-r2").textContent = (info.metrics.r2 * 100).toFixed(1) + "%";
      $("s-mae").textContent = "±" + fmt(info.metrics.mae);
      buildChart();
    } catch {
      ui.error.hidden = false;
      ui.error.textContent = "Can't reach the server. Start it with `python app.py`.";
    }
    setYears(years);
  }
  init();
})();
