(() => {
  const overlay = document.getElementById("final-intro");
  if (!overlay) return;

  const KEY = "bala_hoje_final_intro";
  const force = new URLSearchParams(location.search).get("intro") === "1";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let seen = false;
  try {
    seen = sessionStorage.getItem(KEY) === "1";
  } catch {
    seen = false;
  }

  const markSeen = () => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore quota / private mode */
    }
  };

  const unlockPage = () => {
    document.documentElement.classList.remove("intro-pending");
  };

  const dismiss = (instant) => {
    if (overlay.dataset.done === "1") return;
    overlay.dataset.done = "1";
    markSeen();
    stopFx();
    if (instant) {
      overlay.remove();
      unlockPage();
      return;
    }
    overlay.classList.add("is-leaving");
    window.setTimeout(() => {
      overlay.remove();
      unlockPage();
    }, 850);
  };

  if (!force && (seen || reduced || !document.documentElement.classList.contains("intro-pending"))) {
    overlay.remove();
    unlockPage();
    return;
  }

  const canvas = overlay.querySelector(".final-intro-fx");
  const skip = overlay.querySelector(".final-intro-skip");
  const ctx = canvas.getContext("2d", { alpha: true });
  const sparks = [];
  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let running = true;

  const GOLD = [212, 177, 90];
  const RED = [211, 18, 42];
  const PAPER = [244, 234, 214];

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = overlay.clientWidth;
    h = overlay.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const rand = (a, b) => a + Math.random() * (b - a);

  const burst = (cx, cy, color, count, speed) => {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + rand(-0.2, 0.2);
      const v = rand(speed * 0.35, speed);
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: rand(0.45, 0.95),
        age: 0,
        size: rand(1.2, 3.1),
        color,
      });
    }
  };

  const clash = () => {
    const cx = w * 0.5;
    const cy = h * 0.58;
    burst(cx, cy, GOLD, 42, 8.5);
    burst(cx, cy, RED, 36, 7.2);
    burst(cx, cy, PAPER, 18, 5.4);
  };

  const tick = (now) => {
    if (!running) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.age += dt;
      if (s.age >= s.life) {
        sparks.splice(i, 1);
        continue;
      }
      s.vx *= 0.985;
      s.vy *= 0.985;
      s.x += s.vx;
      s.y += s.vy;
      const t = 1 - s.age / s.life;
      ctx.fillStyle = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${t})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (0.45 + t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    raf = window.requestAnimationFrame(tick);
  };

  function stopFx() {
    running = false;
    window.cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
  }

  skip?.addEventListener("click", () => dismiss(false));
  overlay.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" || ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      dismiss(false);
    }
  });

  resize();
  window.addEventListener("resize", resize);
  last = performance.now();
  raf = window.requestAnimationFrame(tick);
  window.setTimeout(clash, 780);
  window.setTimeout(() => burst(w * 0.5, h * 0.58, GOLD, 18, 4.2), 1180);
  window.setTimeout(() => dismiss(false), reduced ? 1600 : 6200);
})();
