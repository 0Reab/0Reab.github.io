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
`,'color:#00ff40;');

/* live filter over index tables (blog, personal) */
try { (function () {
    var search = document.querySelector(".search");
    if (!search) return;
    var rows = [].slice.call(document.querySelectorAll(".index-table tbody tr"));
    var none = document.querySelector(".no-match");
    search.setAttribute("aria-label", "Filter entries");
    search.addEventListener("input", function () {
        var q = search.value.trim().toLowerCase(), shown = 0;
        rows.forEach(function (r) {
            var hit = r.textContent.toLowerCase().indexOf(q) !== -1;
            r.style.display = hit ? "" : "none";
            if (hit) shown++;
        });
        if (none) none.style.display = shown ? "none" : "block";
    });
})(); } catch (e) { console.warn("filter setup failed:", e); }

/* matrix rain background (+ rain toggle & scroll-to-top corner buttons) */
function initRain() {
    var canvas = document.createElement("canvas");
    canvas.id = "bg-rain";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);

    var ctx = canvas.getContext("2d");
    if (!ctx) canvas.remove();

    var CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF$+-*/=%\"'#<>|?[]{}";
    var FONT = 14;
    // reduced-motion users get a gentler but still animated rain
    var GENTLE = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var w, h, cols, drops, speeds;
    var running = false, raf = 0, last = 0;
    var STEP = GENTLE ? 130 : 66;
    var PEAK = 9, FADE = 7;
    var GLOW_A = [0.10, 0.16, 0.30, 0.42, 0.22];
    if (ctx) {
        try { running = localStorage.getItem("reab-rain") !== "off"; } catch (e) { running = true; }
    }

    function resize() {
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        w = window.innerWidth; h = window.innerHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.ceil(w / FONT);
        drops = new Array(cols);
        speeds = new Array(cols);
        for (var i = 0; i < cols; i++) reset(i, true);
        paint();
    }
    function reset(i, init) {
        // drops/speeds are measured in font cells, not pixels
        drops[i] = init ? Math.random() * (h / FONT) : -Math.random() * 22;
        speeds[i] = (GENTLE ? 0.3 : 0.5) + Math.random() * (GENTLE ? 0.5 : 0.9);
    }
    function glyph(i, cell) {
        // stable per (column, cell) so glyphs never flicker between frames
        var seed = (i * 7919 + cell * 104729) & 0x7fffffff;
        return CHARS.charAt(seed % CHARS.length);
    }
    function curve(d) {
        // per-glyph life: enters dark at the falling tip, brightens up to
        // #0dff82 at PEAK cells above the tip, then decays out (fade-IN)
        if (d < 0 || d > PEAK + FADE) return 0;
        if (d <= PEAK) return 0.08 + 0.87 * Math.pow(d / PEAK, 1.6);
        var t = 1 - (d - PEAK) / FADE;
        return 0.95 * Math.pow(t, 1.6);
    }
    function paint() {
        ctx.fillStyle = "rgb(16, 26, 21)";
        ctx.fillRect(0, 0, w, h);
        ctx.font = FONT + "px monospace";
        for (var i = 0; i < cols; i++) {
            var head = Math.floor(drops[i]);
            var frac = drops[i] - head;
            var x = i * FONT;
            for (var d = 0; d <= PEAK + FADE; d++) {
                var y = head - d;
                if (y < 0) continue;
                if (y >= h) continue;
                var a = curve(d + frac);
                if (a < 0.03) continue;
                var gi = d - (PEAK - 2);
                if (gi >= 0 && gi < GLOW_A.length) {
                    // stacked soft glows along the bright band: re-creates the
                    // saturated glow column that the panel's glass blur samples
                    var gx = x + FONT / 2, gy = y * FONT - FONT / 3;
                    var r = 26;
                    var ga = GLOW_A[gi];
                    var grad = ctx.createRadialGradient(gx, gy, 1, gx, gy, r);
                    grad.addColorStop(0, "rgba(13, 255, 130, " + ga + ")");
                    grad.addColorStop(1, "rgba(13, 255, 130, 0)");
                    ctx.fillStyle = grad;
                    ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
                }
                ctx.fillStyle = "rgba(13, 255, 130, " + a.toFixed(3) + ")";
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
    function startRain() {
        if (raf) return;
        last = 0;
        raf = requestAnimationFrame(loop);
    }
    function stopRain() {
        running = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    window.addEventListener("resize", function () { resize(); });

    /* rain toggle in the header nav + scroll-to-top corner button */
    var corner = document.createElement("div");
    corner.className = "corner-btns";

    var rainBtn = document.createElement("button");
    rainBtn.type = "button";
    rainBtn.className = "corner-btn rain-btn";
    function labelRain() {
        rainBtn.textContent = "rain";
        rainBtn.setAttribute("aria-pressed", String(running));
        rainBtn.classList.toggle("is-paused", !running);
    }
    rainBtn.addEventListener("click", function () {
        running = !running;
        labelRain();
        try { localStorage.setItem("reab-rain", running ? "on" : "off"); } catch (e) {}
        if (running) startRain(); else stopRain();
    });

    var topBtn = document.createElement("button");
    topBtn.type = "button";
    topBtn.className = "corner-btn";
    topBtn.id = "to-top";
    topBtn.setAttribute("aria-label", "Scroll to top");
    topBtn.textContent = "↑ top";
    topBtn.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: GENTLE ? "auto" : "smooth" });
    });
    function onScroll() {
        var y = window.scrollY || document.documentElement.scrollTop || 0;
        topBtn.classList.toggle("show", y > 400);
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    var nav = document.querySelector(".navs");
    if (nav) nav.appendChild(rainBtn); else corner.appendChild(rainBtn);
    corner.appendChild(topBtn);
    document.body.appendChild(corner);

    if (ctx) {
        // paint one full frame at start so the background looks "paused", not blank
        resize();
        labelRain();
        if (running) startRain();
    } else {
        running = false;
        labelRain();
        rainBtn.disabled = true;
    }
    onScroll();
}

try { initRain(); } catch (e) { console.warn("rain background failed to initialize:", e); }
// safety net: if parse-time init ever fails on a page, retry once after full load
window.addEventListener("load", function () {
    if (!document.getElementById("bg-rain")) {
        try { initRain(); } catch (e) { console.warn("rain retry failed:", e); }
    }
});
