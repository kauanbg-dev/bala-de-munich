(() => {
  const overlay = document.getElementById("final-intro");
  if (!overlay) return;

  const KEY = "bala_final_intro";
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
  const rockets = [];
  const sparks = [];
  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let spawnAt = 0;
  let running = true;

  const GOLD = [212, 177, 90];
  const RED = [211, 18, 42];
  const PAPER = [244, 234, 214];
  const palettes = [GOLD, RED, PAPER, GOLD];

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = overlay.clientWidth;
    h = overlay.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[(Math.random() * list.length) | 0];

  const explode = (x, y, color, big) => {
    const count = big ? 96 : 56;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + rand(-0.12, 0.12);
      const speed = rand(big ? 1.4 : 0.9, big ? 7.2 : 4.8);
      sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rand(0.7, 1.35),
        age: 0,
        size: rand(1.2, big ? 3.2 : 2.4),
        color,
        flicker: Math.random() < 0.22,
      });
    }
    for (let i = 0; i < (big ? 18 : 8); i += 1) {
      sparks.push({
        x,
        y,
        vx: rand(-1.2, 1.2),
        vy: rand(-3.4, -0.4),
        life: rand(0.9, 1.8),
        age: 0,
        size: rand(0.8, 1.6),
        color: PAPER,
        flicker: true,
      });
    }
  };

  const launch = (big) => {
    const fromLeft = Math.random() < 0.5;
    rockets.push({
      x: fromLeft ? rand(w * 0.08, w * 0.38) : rand(w * 0.62, w * 0.92),
      y: h + 8,
      vx: rand(-0.55, 0.55),
      vy: rand(-9.6, -7.2),
      color: pick(palettes),
      big: Boolean(big),
      burstY: rand(h * 0.18, h * 0.46),
      trail: [],
    });
  };

  const burstNearCrest = (big) => {
    explode(
      w * 0.5 + rand(-w * 0.34, w * 0.34),
      h * 0.34 + rand(-h * 0.08, h * 0.2),
      pick(palettes),
      Boolean(big)
    );
  };

  const tick = (now) => {
    if (!running) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;

    if (now > spawnAt) {
      if (Math.random() < 0.55) launch(Math.random() < 0.35);
      burstNearCrest(Math.random() < 0.4);
      spawnAt = now + rand(140, 320);
    }

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    for (let i = rockets.length - 1; i >= 0; i -= 1) {
      const r = rockets[i];
      r.vy += 0.085;
      r.x += r.vx;
      r.y += r.vy;
      r.trail.push({ x: r.x, y: r.y });
      if (r.trail.length > 10) r.trail.shift();

      if (r.vy >= -0.85 || r.y <= r.burstY) {
        explode(r.x, r.y, r.color, r.big);
        rockets.splice(i, 1);
        continue;
      }

      for (let t = 0; t < r.trail.length; t += 1) {
        const p = r.trail[t];
        const a = t / r.trail.length;
        ctx.fillStyle = `rgba(${r.color[0]},${r.color[1]},${r.color[2]},${0.18 + a * 0.55})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4 * a + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.age += dt;
      if (s.age >= s.life) {
        sparks.splice(i, 1);
        continue;
      }
      s.vy += 2.8 * dt;
      s.vx *= 0.992;
      s.x += s.vx;
      s.y += s.vy;
      const t = 1 - s.age / s.life;
      const a = s.flicker ? t * (0.55 + Math.random() * 0.45) : t;
      ctx.fillStyle = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (0.5 + t), 0, Math.PI * 2);
      ctx.fill();
    }

    if (sparks.length > 1400) sparks.splice(0, sparks.length - 1400);
    ctx.globalCompositeOperation = "source-over";
    raf = window.requestAnimationFrame(tick);
  };

  function stopFx() {
    running = false;
    window.cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
  }

  const onSkip = () => dismiss(false);
  skip?.addEventListener("click", onSkip);
  overlay.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" || ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      dismiss(false);
    }
  });

  resize();
  window.addEventListener("resize", resize);
  last = performance.now();
  spawnAt = last + 180;
  launch(true);
  launch(true);
  burstNearCrest(true);
  window.setTimeout(() => {
    launch(true);
    burstNearCrest(true);
  }, 280);
  window.setTimeout(() => burstNearCrest(true), 520);
  raf = window.requestAnimationFrame(tick);
  window.setTimeout(() => dismiss(false), reduced ? 1600 : 6800);
})();
