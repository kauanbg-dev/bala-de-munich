const club = window.CLUB;

document.getElementById("kicker").textContent =
  `${club.platform}  ·  ${club.league}  ·  ${club.region}`;
document.getElementById("motto").textContent = club.motto;
document.getElementById("instagram").href = club.instagram;
document.getElementById("lives").href = club.links;
document.getElementById("kick").href = club.kick;
document.getElementById("discord").href = club.discord;

const s = club.stats;
document.getElementById("stat-strip").innerHTML = [
  ["Grupo C", `${s.groupPos}`],
  ["Pontos", s.points],
  ["Séries", `${s.seriesWins}–${s.seriesLosses}`],
  ["Gols (grupos)", `${s.goalsFor} / ${s.goalsAgainst}`],
]
  .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
  .join("");

document.getElementById("last-match").innerHTML = `
  <span>Última série</span>
  <strong>${club.lastMatch.score}</strong>
  <p>vs ${club.lastMatch.opponent}${club.lastMatch.note ? ` · ${club.lastMatch.note}` : ""}</p>
`;

document.getElementById("next-match").innerHTML = `
  <span>Próximo jogo · ${club.nextMatch.venue}</span>
  <strong>vs ${club.nextMatch.opponent}</strong>
  <p>${club.nextMatch.competition} · ${club.nextMatch.date}</p>
`;

const clubMeta = (name) => club.clubs[name] || { owner: "–", tbd: true };

const chaveSide = (name, score, win) => {
  const t = clubMeta(name);
  const crest = t.crest
    ? `<img class="chave-crest" src="${t.crest}" alt="" />`
    : `<span class="chave-crest is-empty" aria-hidden="true"></span>`;
  const bg = t.crest ? `<img src="${t.crest}" alt="" />` : "";
  return `
    <div class="chave-side${win ? " is-win" : ""}${t.us ? " is-us" : ""}${t.tbd ? " is-tbd" : ""}">
      <span class="chave-bg" aria-hidden="true">${bg}</span>
      <div class="chave-team">${crest}<span class="chave-txt"><b>${name}</b><small>${t.owner}</small></span></div>
      <span class="chave-score">${score}</span>
    </div>`;
};

const chaveCard = (t) => {
  const played = t.hs !== null && t.as !== null;
  const homeWin = played && t.hs > t.as;
  const awayWin = played && t.as > t.hs;
  return `
    <article class="chave-match${t.us ? " is-us" : ""}${t.final ? " is-final" : ""}${played ? " is-done" : ""}" id="${t.id}">
      ${t.final ? `<span class="chave-cup" aria-hidden="true"></span>` : ""}
      ${chaveSide(t.home, played ? t.hs : "–", homeWin)}
      ${chaveSide(t.away, played ? t.as : "–", awayWin)}
      <small>${t.date}</small>
    </article>`;
};

const doneCount = club.bracket.flatMap((r) => r.ties).filter((t) => t.hs !== null).length;
const openCount = club.bracket.flatMap((r) => r.ties).length - doneCount;
const legend = document.getElementById("chave-legend");
if (legend) legend.innerHTML = `<span class="is-done">${doneCount} encerradas</span><span>${openCount} a disputar</span>`;

document.getElementById("bracket").innerHTML = `
  <svg class="chave-wires" aria-hidden="true"></svg>
  <div class="chave-cols">
    ${club.bracket
      .map(
        (round) => `
      <span class="chave-lab chave-lab-${round.key}">${round.n} · ${round.round}</span>
      ${round.ties.map(chaveCard).join("")}`
      )
      .join("")}
  </div>`;

const drawChaveWires = () => {
  const stage = document.getElementById("bracket");
  const svg = stage?.querySelector(".chave-wires");
  if (!stage || !svg) return;
  const sr = stage.getBoundingClientRect();
  svg.setAttribute("width", String(Math.round(sr.width)));
  svg.setAttribute("height", String(Math.round(sr.height)));
  svg.setAttribute("viewBox", `0 0 ${sr.width} ${sr.height}`);
  const mid = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      left: r.left - sr.left,
      right: r.right - sr.left,
      y: r.top + r.height / 2 - sr.top,
    };
  };
  const pairs = [
    ["qf-0", "sf-0"],
    ["qf-1", "sf-0"],
    ["qf-2", "sf-1"],
    ["qf-3", "sf-1"],
    ["sf-0", "ff-0"],
    ["sf-1", "ff-0"],
  ];
  const paths = [];
  const nodes = [];
  pairs.forEach(([from, to]) => {
    const a = mid(from);
    const b = mid(to);
    if (!a || !b) return;
    const mx = (a.right + b.left) / 2;
    paths.push(`<path class="chave-wire" d="M${a.right},${a.y}H${mx}V${b.y}H${b.left}" />`);
    nodes.push(
      `<circle class="chave-wire-node" cx="${a.right}" cy="${a.y}" r="3" />`,
      `<circle class="chave-wire-node" cx="${b.left}" cy="${b.y}" r="3" />`
    );
  });
  svg.innerHTML = paths.join("") + nodes.join("");
};

drawChaveWires();
window.addEventListener("resize", drawChaveWires);
document.querySelectorAll("#bracket img").forEach((img) => img.addEventListener("load", drawChaveWires, { once: true }));
if (window.ResizeObserver && document.getElementById("bracket")) {
  new ResizeObserver(drawChaveWires).observe(document.getElementById("bracket"));
}

document.getElementById("feed-grid").innerHTML = club.gallery
  .slice(0, 3)
  .map(
    (item) => `
    <a class="feed-card" href="${club.instagram}" target="_blank" rel="noreferrer">
      <img src="${item.src}" alt="${item.alt}" />
      <span>${item.caption}</span>
    </a>`
  )
  .join("");

document.getElementById("standings").innerHTML = club.groupTable
  .map(
    (row) => `
    <tr class="${row.us ? "us" : ""}">
      <td>${row.pos}º</td>
      <td>${row.team}${row.us ? " · classificado" : ""}</td>
      <td>${row.j}</td>
      <td>${row.pts}</td>
      <td>${row.v}</td>
      <td>${row.d}</td>
      <td>${row.gp}</td>
      <td>${row.gc}</td>
      <td>${row.sg > 0 ? "+" + row.sg : row.sg}</td>
    </tr>`
  )
  .join("");

document.getElementById("scorers").innerHTML = club.scorers
  .map(
    (p) =>
      `<li><b>${p.tag}</b> <span>${p.pos}</span> <strong>${p.goals}</strong></li>`
  )
  .join("");

document.getElementById("assists").innerHTML = club.assists
  .map(
    (p) =>
      `<li><b>${p.tag}</b> <span>${p.pos}</span> <strong>${p.assists}</strong></li>`
  )
  .join("");

document.getElementById("squad").innerHTML = club.squad
  .map(
    (p) => `
    <article class="player${p.photo ? " has-photo" : ""}">
      ${p.photo ? `<img class="player-photo" src="${p.photo}" alt="${p.tag}" />` : `<img class="player-photo fallback" src="assets/crest.jpg" alt="" />`}
      <div class="player-body">
      <div class="num">${p.number === 0 ? "C" : String(p.number).padStart(2, "0")}</div>
      ${p.rating ? `<div class="ovr">${p.rating}</div>` : ""}
      <div class="tag">${p.tag}</div>
      <div class="meta">${[p.pos !== "—" ? p.pos : "", p.role].filter(Boolean).join(" · ")}</div>
      <div class="meta">${[
        p.games ? `${p.games}J` : "",
        p.goals ? `${p.goals}G` : "",
        p.assists ? `${p.assists}A` : "",
        p.rating ? `nota ${p.rating}` : "",
      ]
        .filter(Boolean)
        .join(" · ")}</div>
      </div>
    </article>`
  )
  .join("");

document.getElementById("pitch").innerHTML = club.formation.slots
  .map((slot) => {
    const kind = slot.pos === "GOL" ? "gk" : slot.pos === "TEC" ? "coach" : "";
    return `
    <div class="slot ${kind}" style="left:${slot.x}%;top:${slot.y}%">
      <div class="dot"></div>
      <span><small>${slot.pos === "TEC" ? "TEC" : slot.pos}</small><b>${slot.tag}</b></span>
    </div>`;
  })
  .join("");

document.getElementById("results").innerHTML = club.results
  .map(
    (r) => `
    <li>
      <span>${r.date}</span>
      <span>${r.opponent}${r.note ? ` · ${r.note}` : ""}</span>
      <span class="score">${r.score}</span>
      <span class="badge ${r.result}">${r.result}</span>
    </li>`
  )
  .join("");

document.getElementById("rules").innerHTML = club.houseRules
  .map((rule) => `<li>${rule}</li>`)
  .join("");

const mvpPoll = club.mvp;
const mvpKey = `mvp-vote:${mvpPoll.id}`;
const mvpCandidates = club.squad.filter((p) => p.pos !== "—");
const mvpCopy = document.getElementById("mvp-copy");
if (mvpCopy) {
  mvpCopy.textContent = `${mvpPoll.match}. Um voto por pessoa. Só o Bala abre, pausa e retoma a urna.`;
}

const asVoteMap = (totals) => {
  if (!totals || Array.isArray(totals)) {
    const map = {};
    (totals || []).forEach((row) => {
      if (row && row.player) map[row.player] = Number(row.votes) || 0;
    });
    return map;
  }
  return totals;
};

let mvpState = {
  totals: {},
  total: 0,
  voted: false,
  mine: null,
  started: false,
  open: false,
  paused: false,
  remainingMs: 0,
  endsAt: null,
};
const mvpAdmin = document.getElementById("mvp-admin");
const mvpAdminOps = document.getElementById("mvp-admin-ops");
const isMvpAdminPage = new URLSearchParams(window.location.search).has("admin");
if (mvpAdmin && isMvpAdminPage) mvpAdmin.hidden = false;
let mvpAdminPin = isMvpAdminPage ? sessionStorage.getItem("mvp-admin-pin") || "" : "";
let mvpTimer = null;

const pad2 = (n) => String(n).padStart(2, "0");

const formatRemain = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${pad2(m)}m ${pad2(sec)}s`;
};

const mvpPct = (tag) => {
  if (!mvpState.total) return 0;
  return Math.round((100 * (Number(mvpState.totals[tag]) || 0)) / mvpState.total);
};

const renderMvp = () => {
  const grid = document.getElementById("mvp-grid");
  const status = document.getElementById("mvp-status");
  const clock = document.getElementById("mvp-clock");
  const startBtn = document.getElementById("mvp-start");
  const pauseBtn = document.getElementById("mvp-pause");
  const resumeBtn = document.getElementById("mvp-resume");
  if (!grid || !status) return;
  const locked = mvpState.voted || !mvpState.open;
  if (clock) {
    if (!mvpState.started) clock.textContent = "Aguardando início";
    else if (mvpState.paused) clock.textContent = `Pausada · ${formatRemain(mvpState.remainingMs)}`;
    else if (mvpState.open) clock.textContent = formatRemain(mvpState.remainingMs);
    else clock.textContent = "Encerrada";
  }
  if (mvpAdminOps && mvpAdminPin) {
    mvpAdminOps.hidden = false;
    if (startBtn) startBtn.disabled = mvpState.started;
    if (pauseBtn) pauseBtn.disabled = !mvpState.open;
    if (resumeBtn) resumeBtn.disabled = !mvpState.paused || mvpState.remainingMs <= 0;
  }
  const ranked = [...mvpCandidates].sort(
    (a, b) => (Number(mvpState.totals[b.tag]) || 0) - (Number(mvpState.totals[a.tag]) || 0)
  );
  const plural = mvpState.total === 1 ? "voto" : "votos";
  if (!mvpState.started) {
    status.textContent = "Aguardando o Bala abrir a urna. Dois horas no relógio, um voto por pessoa.";
  } else if (mvpState.paused) {
    status.textContent = `Votação pausada. ${mvpState.total} ${plural} até agora.`;
  } else if (mvpState.voted) {
    status.textContent = `Voto registrado em ${mvpState.mine}. ${mvpState.total} ${plural} no total.`;
  } else if (mvpState.open) {
    status.textContent = `${mvpState.total} ${plural} até agora. Escolhe um e confirma.`;
  } else {
    status.textContent = `Votação encerrada. ${mvpState.total} ${plural} no total.`;
  }
  grid.innerHTML = ranked
    .map((p) => {
      const n = Number(mvpState.totals[p.tag]) || 0;
      const pct = mvpPct(p.tag);
      const photo = p.photo || "assets/crest.jpg";
      const mine = mvpState.mine === p.tag;
      return `
        <article class="mvp-card${mine ? " is-mine" : ""}">
          <img src="${photo}" alt="" class="${p.photo ? "" : "fallback"}" />
          <div>
            <b>${p.tag}</b>
            <small>${p.pos}</small>
            <span class="mvp-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
            <em>${n} · ${pct}%</em>
            <button type="button" data-mvp="${p.tag}" ${locked ? "disabled" : ""}>${mine ? "Seu voto" : "Votar"}</button>
          </div>
        </article>`;
    })
    .join("");
};

const applyMvpData = (data) => {
  mvpState.totals = asVoteMap(data.totals);
  mvpState.total = Number(data.total) || 0;
  mvpState.started = Boolean(data.started);
  mvpState.open = Boolean(data.open);
  mvpState.paused = Boolean(data.paused);
  mvpState.remainingMs = Number(data.remainingMs) || 0;
  mvpState.endsAt = data.endsAt || null;
  if (data.voted && data.mine) {
    mvpState.voted = true;
    mvpState.mine = data.mine;
    localStorage.setItem(mvpKey, data.mine);
  }
};

const tickMvp = () => {
  if (!mvpState.started || !mvpState.open) return;
  mvpState.remainingMs = Math.max(0, mvpState.remainingMs - 1000);
  if (mvpState.remainingMs <= 0) {
    mvpState.open = false;
    refreshMvp();
    return;
  }
  const clock = document.getElementById("mvp-clock");
  if (clock) clock.textContent = formatRemain(mvpState.remainingMs);
};

const refreshMvp = async () => {
  try {
    const res = await fetch(`/api/mvp?poll=${encodeURIComponent(mvpPoll.id)}`, { credentials: "same-origin" });
    if (!res.ok) throw new Error("api");
    applyMvpData(await res.json());
  } catch {
    const saved = localStorage.getItem(mvpKey);
    if (saved) {
      mvpState.voted = true;
      mvpState.mine = saved;
    } else if (document.getElementById("mvp-status")) {
      document.getElementById("mvp-status").textContent =
        "Servidor de votação fora do ar. Sobe o site local pra contar os votos.";
      renderMvp();
      return;
    }
  }
  renderMvp();
};

const showMvpAdminOps = () => {
  const login = document.getElementById("mvp-admin-login");
  if (login) login.hidden = true;
  if (mvpAdminOps) mvpAdminOps.hidden = false;
};

if (mvpAdminPin) showMvpAdminOps();

const postMvpAdmin = async (action) => {
  const res = await fetch("/api/mvp", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ poll: mvpPoll.id, action, pin: mvpAdminPin }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 403) {
    const status = document.getElementById("mvp-status");
    if (status) status.textContent = "Código admin errado.";
    throw new Error("pin");
  }
  if (action !== "auth") applyMvpData(data);
  renderMvp();
  return res;
};

document.getElementById("mvp-admin-login")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const field = document.getElementById("mvp-pin");
  mvpAdminPin = (field?.value || "").trim();
  try {
    await postMvpAdmin("auth");
    sessionStorage.setItem("mvp-admin-pin", mvpAdminPin);
    showMvpAdminOps();
  } catch {
    mvpAdminPin = "";
    sessionStorage.removeItem("mvp-admin-pin");
  }
});

document.getElementById("mvp-start")?.addEventListener("click", () => postMvpAdmin("start").catch(() => {}));
document.getElementById("mvp-pause")?.addEventListener("click", () => postMvpAdmin("pause").catch(() => {}));
document.getElementById("mvp-resume")?.addEventListener("click", () => postMvpAdmin("resume").catch(() => {}));

document.getElementById("mvp-grid")?.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-mvp]");
  if (!btn || mvpState.voted || !mvpState.open) return;
  const tag = btn.getAttribute("data-mvp");
  btn.disabled = true;
  try {
    const res = await fetch("/api/mvp", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poll: mvpPoll.id, player: tag }),
    });
    const data = await res.json();
    if (res.ok || res.status === 409) applyMvpData({ ...data, voted: true, mine: data.mine || tag });
    else if (res.status === 403) applyMvpData(data);
    else throw new Error("vote");
  } catch {
    const status = document.getElementById("mvp-status");
    if (status) status.textContent = "Não rolou registrar o voto. Tenta de novo.";
    btn.disabled = false;
  }
  renderMvp();
});

refreshMvp();
mvpTimer = window.setInterval(tickMvp, 1000);

const siteNav = document.getElementById("site-nav");
const navToggle = document.querySelector(".nav-toggle");
if (siteNav && navToggle) {
  navToggle.addEventListener("click", () => {
    const open = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const creatorBtn = document.querySelector(".site-creator");
const fadeCreator = () => {
  if (!creatorBtn) return;
  creatorBtn.classList.toggle("is-faded", window.scrollY > 24);
};
fadeCreator();
window.addEventListener("scroll", fadeCreator, { passive: true });
