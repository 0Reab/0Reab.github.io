console.log("Pokin' around are ya? :)");
console.log(`%c
                            _ood>H&H&Z?#M#b-\\.
                        .\\HMMMMMR?\`\\M6b."'\` ''  v.
                     .. .MMMMMMMMMMHMMM#&.      \`\`~o.
                   .   ,HMMMMMMMMMM\` ' '           ?MP?.
                  . |MMMMMMMMMMM'                 \`"$b&\\
                 -  |MMMMHH##M'                     HMMH?
                -   TTM|     >..                   \\HMMMMH
               :     |MM\\,#-""$~b\\.                \`MMMMMM+
              .       \`\`"H&#        -               &MMMMMM|
              :            *\\v,#MHddc.              \`9MMMMMb
              .               MMMMMMMM##\\             \`"":HM
              -          .  .HMMMMMMMMMMRo_.              |M
              :             |MMMMMMMMMMMMMMMM#\\           :M
              -              \`HMMMMMMMMMMMMMM'            |T
              :               \`*HMMMMMMMMMMM'             H'
               :                MMMMMMMMMMM|             |T
                ;               MMMMMMMM?'              ./
                 \`              MMMMMMH'               ./'
                  -            |MMMH#'                 .
                   \`           \`MM*                . \`
                     _          #M: .    .       .-'
                        .          .,         .-'
                           '-.-~ooHH__,,v~--\`'

    __  __           __      __  __            ____  __                 __
   / / / /___ ______/ /__   / /_/ /_  ___     / __ \\/ /___ _____  ___  / /_
  / /_/ / __ \`/ ___/ //_/  / __/ __ \\/ _ \\   / /_/ / / __ \`/ __ \\/ _ \\/ __/
 / __  / /_/ / /__/ ,<    / /_/ / / /  __/  / ____/ / /_/ / / / /  __/ /_
/_/ /_/\__,_/\___/_/|_|   \__/_/ /_/\___/  /_/   /_/\__,_/_/ /_/\___/\__/
`, "color:#00ff40;");

/* live filter over index tables (blog, personal) */
const search = document.querySelector(".search");
if (search) {
  const rows = [...document.querySelectorAll(".index-table tbody tr")];
  const none = document.querySelector(".no-match");
  search.setAttribute("aria-label", "Filter entries");
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    for (const r of rows) {
      const hit = r.textContent.toLowerCase().includes(q);
      r.style.display = hit ? "" : "none";
      shown += hit;
    }
    if (none) none.style.display = shown ? "none" : "block";
  });
}

/* matrix rain background (+ rain toggle & scroll-to-top corner buttons) */
function initRain() {
  const canvas = document.createElement("canvas");
  canvas.id = "bg-rain";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) canvas.remove();

  const CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF$+-*/=%\"'#<>|?[]{}";
  const FONT = 14;
  const GENTLE = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const STEP = GENTLE ? 130 : 66;
  const PEAK = 9;                      // trail length above the tip (with FADE)
  const FADE = 7;
  const GLOW_A = [0.35, 0.42, 0.30, 0.16, 0.08]; // stacked glow alphas riding the tip

  let w, h, cols, drops, speeds;       // drops/speeds in font cells, not pixels
  let raf = 0, last = 0;
  let running = false;
  if (ctx) {
    try { running = localStorage.getItem("reab-rain") === "on"; } catch (e) { /* default off */ }
  }

  const reset = (i, init) => {
    drops[i] = init ? Math.random() * (h / FONT) : -Math.random() * 22;
    speeds[i] = (GENTLE ? 0.3 : 0.5) + Math.random() * (GENTLE ? 0.5 : 0.9);
  };
  // stable per (column, cell) so glyphs never flicker between frames
  const glyph = (i, cell) =>
    CHARS.charAt(((i * 7919 + cell * 104729) & 0x7fffffff) % CHARS.length);
  // per-glyph life: brightest at the falling tip (#0dff82), fading out over
  // the trail cells above it
  const curve = (d) => d < 0 || d > PEAK + FADE ? 0
    : 0.95 * (1 - d / (PEAK + FADE)) ** 1.6;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / FONT);
    drops = new Array(cols);
    speeds = new Array(cols);
    for (let i = 0; i < cols; i++) reset(i, true);
    paint(); // paint one frame even when paused so the bg is never blank
  }

  function paint() {
    ctx.fillStyle = "rgb(16, 26, 21)";
    ctx.fillRect(0, 0, w, h);
    ctx.font = `${FONT}px monospace`;
    for (let i = 0; i < cols; i++) {
      const head = Math.floor(drops[i]);
      const x = i * FONT;
      for (let d = 0; d <= PEAK + FADE; d++) {
        const y = head - d;
        if (y < 0 || y >= h) continue;
        const a = curve(d + drops[i] - head);
        if (a < 0.03) continue;
        const gi = d;
        if (gi >= 0 && gi < GLOW_A.length) {
          // soft glow riding the falling tip, fading up the trail
          const gx = x + FONT / 2, gy = y * FONT - FONT / 3, r = 26;
          const grad = ctx.createRadialGradient(gx, gy, 1, gx, gy, r);
          grad.addColorStop(0, `rgba(13, 255, 130, ${GLOW_A[gi]})`);
          grad.addColorStop(1, "rgba(13, 255, 130, 0)");
          ctx.fillStyle = grad;
          ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
        }
        ctx.fillStyle = `rgba(13, 255, 130, ${a.toFixed(3)})`;
        ctx.fillText(glyph(i, y), x, y * FONT);
      }
      drops[i] += speeds[i];
      if (drops[i] > h / FONT + PEAK + FADE && Math.random() > 0.985) reset(i, false);
    }
  }

  function loop(ts) {
    if (!running) { raf = 0; return; }
    if (!document.hidden && ts - last > STEP) { paint(); last = ts; }
    raf = requestAnimationFrame(loop);
  }
  const setRain = (on) => {
    running = on;
    rainBtn.setAttribute("aria-pressed", String(running));
    rainBtn.classList.toggle("is-paused", !running);
    try { localStorage.setItem("reab-rain", on ? "on" : "off"); } catch (e) {}
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (on) { last = 0; raf = requestAnimationFrame(loop); }
  };

  /* rain toggle + scroll-to-top corner buttons */
  const mkBtn = (cls, text) => Object.assign(document.createElement("button"), {
    type: "button", className: `corner-btn ${cls}`, textContent: text,
  });
  const rainBtn = mkBtn("rain-btn", "rain");
  rainBtn.addEventListener("click", () => setRain(!running));
  const topBtn = mkBtn("", "↑ top");
  topBtn.id = "to-top";
  topBtn.setAttribute("aria-label", "Scroll to top");
  topBtn.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: GENTLE ? "auto" : "smooth" }));
  const onScroll = () => topBtn.classList.toggle("show", (window.scrollY || 0) > 400);

  window.addEventListener("resize", resize);
  window.addEventListener("scroll", onScroll, { passive: true });

  const corner = Object.assign(document.createElement("div"), { className: "corner-btns" });
  (document.querySelector(".navs") || corner).appendChild(rainBtn);
  corner.appendChild(topBtn);
  document.body.appendChild(corner);

  if (ctx) {
    resize();
    rainBtn.setAttribute("aria-pressed", String(running));
    rainBtn.classList.toggle("is-paused", !running);
    if (running) { last = 0; raf = requestAnimationFrame(loop); }
  } else {
    running = false;
    rainBtn.classList.add("is-paused");
    rainBtn.disabled = true;
  }
  onScroll();
}

try { initRain(); } catch (e) { console.warn("rain background failed to initialize:", e); }
// safety net: if parse-time init ever fails on a page, retry once after full load
window.addEventListener("load", () => {
  if (!document.getElementById("bg-rain")) {
    try { initRain(); } catch (e) { console.warn("rain retry failed:", e); }
  }
});
