const club = window.CLUB;

const liveChannel = (player) => {
  try {
    const url = new URL(player.live, window.location.origin);
    const host = url.hostname.replace(/^www\./, "");
    const slug = url.pathname.replace(/^\//, "").split("/")[0];
    if (!slug) return null;
    if (host.includes("kick.com")) {
      return { ...player, kind: "kick", slug, href: player.live, label: "Kick", embed: `https://player.kick.com/${encodeURIComponent(slug)}` };
    }
    if (host.includes("twitch.tv")) {
      const parent = encodeURIComponent(window.location.hostname || "localhost");
      return {
        ...player,
        kind: "twitch",
        slug,
        href: player.live,
        label: "Twitch",
        embed: `https://player.twitch.tv/?channel=${encodeURIComponent(slug)}&parent=${parent}&muted=true`,
      };
    }
  } catch {
    /* URL quebrada no data.js */
  }
  return null;
};

const liveChannels = (club.squad || []).map(liveChannel).filter(Boolean);
const livePrefer = [club.president, club.vice].filter(Boolean);
let liveSelected = null;
let livePlayerReady = false;
window.streamersOnAir = [];

const watchParam = () => {
  try {
    return new URLSearchParams(window.location.search).get("watch") || "";
  } catch {
    return "";
  }
};

const sortLiveChannels = () => {
  liveChannels.sort((a, b) => {
    if (Boolean(a.onAir) !== Boolean(b.onAir)) return a.onAir ? -1 : 1;
    const rank = (p) => {
      const i = livePrefer.findIndex((tag) => String(tag).toLowerCase() === String(p.tag).toLowerCase());
      return i >= 0 ? i : 99;
    };
    return rank(a) - rank(b);
  });
};

const markWatching = () => {
  document.getElementById("lives-watch")?.classList.toggle("is-watching", Boolean(liveSelected));
};

const scrollToPlayer = () => {
  const stage = document.getElementById("lives-stage");
  if (!stage) return;
  const run = () => {
    const bar = document.querySelector(".topbar");
    const offset = (bar?.getBoundingClientRect().height || 0) + 8;
    const top = stage.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
};

const paintLiveIdle = () => {
  const stage = document.getElementById("lives-stage");
  const screen = document.getElementById("lives-screen");
  const now = document.getElementById("lives-now");
  liveSelected = null;
  livePlayerReady = false;
  stage?.classList.add("is-idle");
  markWatching();
  screen?.classList.remove("is-live", "is-twitch", "is-kick");
  if (screen) screen.innerHTML = "";
  if (now) now.textContent = "Clica em alguém pra abrir a live.";
  document.querySelectorAll("#lives-grid .lives-card").forEach((card) => {
    card.classList.remove("is-on");
  });
};

const paintLivePlayer = (channel, { scroll = false } = {}) => {
  const stage = document.getElementById("lives-stage");
  const screen = document.getElementById("lives-screen");
  const now = document.getElementById("lives-now");
  if (!screen || !channel) return;
  const same = liveSelected === channel.tag;
  liveSelected = channel.tag;
  stage?.classList.remove("is-idle");
  markWatching();
  screen.classList.toggle("is-live", Boolean(channel.onAir));
  screen.classList.toggle("is-twitch", channel.kind === "twitch");
  screen.classList.toggle("is-kick", channel.kind !== "twitch");
  if (!same || !livePlayerReady) {
    screen.innerHTML = `<iframe src="${channel.embed}" title="Live de ${channel.tag}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    livePlayerReady = true;
  }
  if (now) {
    const watching = channel.onAir ? "Ao vivo" : `Canal ${channel.label}`;
    now.innerHTML = `${watching} · <b>${channel.tag}</b>. <a href="${channel.href}" target="_blank" rel="noreferrer">Abrir no app</a>`;
  }
  document.querySelectorAll("#lives-grid .lives-card").forEach((card) => {
    const tag = card.getAttribute("data-tag");
    card.classList.toggle("is-on", tag === channel.tag);
  });
  if (scroll) scrollToPlayer();
};

const cardHtml = (p) => `
      <button class="lives-card is-${p.kind}${p.onAir ? " is-live" : ""}${liveSelected === p.tag ? " is-on" : ""}" type="button" data-tag="${p.tag}">
        <span class="lives-face">
          <img src="${p.photo || "assets/crest.png"}" alt="" loading="lazy" />
          ${p.onAir ? `<i class="lives-dot" aria-hidden="true"></i>` : ""}
        </span>
        <span>
          <b>${p.tag}</b>
          <small>${p.onAir ? "Ao vivo" : `${p.label} · ${p.slug}`}</small>
        </span>
      </button>`;

const paintLivesGrid = () => {
  const grid = document.getElementById("lives-grid");
  const n = document.getElementById("lives-onair-n");
  if (!grid) return;
  sortLiveChannels();
  const air = liveChannels.filter((c) => c.onAir);
  const off = liveChannels.filter((c) => !c.onAir);
  if (n) n.textContent = air.length ? `${air.length} ao vivo agora` : "Ninguém no ar agora";
  grid.innerHTML = [
    ...air.map(cardHtml),
    air.length && off.length ? `<p class="lives-split">Fora do ar</p>` : "",
    ...off.map(cardHtml),
  ].join("");
};

const paintLives = () => {
  const grid = document.getElementById("lives-grid");
  const screen = document.getElementById("lives-screen");
  if (grid && screen) {
    if (!liveChannels.length) {
      document.getElementById("lives-stage")?.classList.remove("is-idle");
      screen.innerHTML = `<p class="lives-empty">Nenhuma live cadastrada no elenco ainda.</p>`;
      grid.innerHTML = "";
    } else {
      paintLivesGrid();
      const current = liveChannels.find((p) => p.tag === liveSelected);
      if (current) paintLivePlayer(current);
      else paintLiveIdle();
    }
  }
  window.paintHeroLive?.();
  window.paintLiveNow?.();
  window.paintSquadLive?.();
};

const pullLiveStatus = async () => {
  const kick = liveChannels.filter((c) => c.kind === "kick").map((c) => c.slug);
  const twitch = liveChannels.filter((c) => c.kind === "twitch").map((c) => c.slug);
  if (!kick.length && !twitch.length) return;
  try {
    const q = new URLSearchParams();
    if (kick.length) q.set("c", kick.join(","));
    if (twitch.length) q.set("t", twitch.join(","));
    const res = await fetch(`/api/lives?${q}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const map = data?.live || {};
    liveChannels.forEach((c) => {
      const slug = String(c.slug).toLowerCase();
      const hit = map[`${c.kind}:${slug}`] || map[slug];
      c.onAir = Boolean(hit?.live);
      c.viewers = hit?.viewers;
      c.title = hit?.title;
    });
    window.streamersOnAir = liveChannels.filter((c) => c.onAir);
    paintLives();
  } catch {
    /* mantém a grade sem selo */
  }
};

const paintHeroLive = () => {
  const btn = document.getElementById("hero-live");
  if (!btn) return;
  const air = liveChannels.some((c) => c.onAir);
  btn.classList.toggle("is-on", air);
  btn.setAttribute("aria-label", air ? "Ir para as lives — alguém ao vivo agora" : "Ir para as lives");
};
window.paintHeroLive = paintHeroLive;

const openFromWatch = () => {
  const wanted = watchParam().toLowerCase();
  if (!wanted) return;
  const channel = liveChannels.find((p) => String(p.tag).toLowerCase() === wanted || String(p.slug).toLowerCase() === wanted);
  if (channel) paintLivePlayer(channel, { scroll: true });
};

const pickFromEvent = (event) => {
  const card = event.target.closest("[data-tag], [data-live-tag]");
  if (!card) return;
  const tag = card.getAttribute("data-tag") || card.getAttribute("data-live-tag");
  const channel = liveChannels.find((p) => p.tag === tag);
  if (channel) paintLivePlayer(channel, { scroll: true });
};

document.getElementById("lives-grid")?.addEventListener("click", pickFromEvent);
document.getElementById("live-band")?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-live-tag]");
  if (!card) return;
  const channel = liveChannels.find((p) => p.tag === card.getAttribute("data-live-tag"));
  if (!channel) return;
  if (document.body.classList.contains("page-lives")) {
    event.preventDefault();
    paintLivePlayer(channel, { scroll: true });
    return;
  }
  /* no site principal o card já aponta pra /lives?watch= */
});

const siteNav = document.getElementById("site-nav");
const navToggle = document.querySelector(".nav-toggle");
if (siteNav && navToggle && document.body.classList.contains("page-lives")) {
  const closeNav = () => {
    siteNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  };
  navToggle.addEventListener("click", () => {
    const open = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeNav);
  });
  document.addEventListener("click", (event) => {
    if (!siteNav.classList.contains("is-open")) return;
    if (siteNav.contains(event.target) || navToggle.contains(event.target)) return;
    closeNav();
  });
}

paintLives();
paintHeroLive();
openFromWatch();
pullLiveStatus();
window.setInterval(pullLiveStatus, 45_000);
