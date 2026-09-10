const club = window.CLUB;

document.getElementById("kicker").textContent =
  `${club.platform}  ·  ${club.league}  ·  ${club.region}`;
document.getElementById("motto").textContent = club.motto;
document.getElementById("instagram").href = club.instagram;
document.getElementById("lives").href = club.links;
document.getElementById("discord").href = club.discord;

const paintCompetition = () => {
  const s = club.stats;
  document.getElementById("stat-strip").innerHTML = [
    ["Grupo C", `${s.groupPos}`],
    ["Pontos", s.points],
    ["Séries", `${s.seriesWins}–${s.seriesLosses}`],
    ["Gols (grupos)", `${s.goalsFor} / ${s.goalsAgainst}`],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join("");

  document.getElementById("motto").textContent = club.motto;

  const clubMeta = (name) => club.clubs[name] || { owner: "–", tbd: true };

  const teamMark = (name, extra = "") => {
    const t = clubMeta(name);
    const crest = t.crest
      ? `<img class="team-crest" src="${t.crest}" alt="" />`
      : `<span class="team-crest is-empty" aria-hidden="true"></span>`;
    return `<span class="team-mark${t.tbd ? " is-tbd" : ""}">${crest}<span>${name}${extra}</span></span>`;
  };

  document.getElementById("last-match").innerHTML = `
    <span>Última série</span>
    <strong>${club.lastMatch.score}</strong>
    <p>vs ${teamMark(club.lastMatch.opponent)}${club.lastMatch.note ? ` · ${club.lastMatch.note}` : ""}</p>
  `;

  document.getElementById("next-match").innerHTML = `
    <span>Próximo jogo · ${club.nextMatch.venue}</span>
    <strong>vs ${teamMark(club.nextMatch.opponent)}</strong>
    <p>${club.nextMatch.competition} · ${club.nextMatch.date}</p>
  `;
  paintMvpCopy();

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

  drawChaveWires();
  document.querySelectorAll("#bracket img").forEach((img) => img.addEventListener("load", drawChaveWires, { once: true }));

  document.getElementById("standings").innerHTML = club.groupTable
    .map(
      (row) => `
    <tr class="${row.us ? "us" : ""}">
      <td>${row.pos}º</td>
      <td>${teamMark(row.team, row.us ? " · classificado" : "")}</td>
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
    .map((p) => `<li><b>${p.tag}</b> <span>${p.pos}</span> <strong>${p.goals}</strong></li>`)
    .join("");

  document.getElementById("assists").innerHTML = club.assists
    .map((p) => `<li><b>${p.tag}</b> <span>${p.pos}</span> <strong>${p.assists}</strong></li>`)
    .join("");

  document.getElementById("results").innerHTML = club.results
    .map(
      (r) => `
    <li>
      <span>${r.date}</span>
      <span>${teamMark(r.opponent, r.note ? ` · ${r.note}` : "")}</span>
      <span class="score">${r.score}</span>
      <span class="badge ${r.result}">${r.result}</span>
    </li>`
    )
    .join("");
};

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

paintCompetition();
window.addEventListener("resize", drawChaveWires);
if (window.ResizeObserver && document.getElementById("bracket")) {
  new ResizeObserver(drawChaveWires).observe(document.getElementById("bracket"));
}

const posOf = (tag) => {
  const hit = club.squad.find((p) => String(p.tag).toLowerCase() === String(tag).toLowerCase());
  return hit?.pos && hit.pos !== "—" ? hit.pos : "";
};

const mergeStatRows = (local, live) => {
  if (!live?.length) return local;
  const localByTag = new Map(local.map((row) => [String(row.tag || "").toLowerCase(), row]));
  const seen = new Set();
  const out = [];
  live.forEach((row) => {
    const id = String(row.tag || "").toLowerCase();
    if (!id || seen.has(id)) return;
    seen.add(id);
    const prev = localByTag.get(id) || {};
    out.push({
      ...prev,
      ...row,
      pos: row.pos || prev.pos || posOf(row.tag),
      games: row.games || prev.games || 0,
    });
  });
  local.forEach((row) => {
    const id = String(row.tag || "").toLowerCase();
    if (id && seen.has(id)) return;
    if (id) seen.add(id);
    out.push(row);
  });
  return out;
};

const mergeResults = (local, live) => {
  if (!live?.length) return local;
  const keyOf = (row) => `${String(row.opponent || "").toLowerCase()}|${row.score || ""}`;
  const seen = new Set(live.map(keyOf));
  return [...live, ...local.filter((row) => !seen.has(keyOf(row)))];
};

const stampCopaLive = (live) => {
  const stamp = document.getElementById("copa-live-stamp");
  if (!stamp) return;
  const at = live.atualizadoEm ? new Date(live.atualizadoEm) : null;
  stamp.hidden = false;
  stamp.textContent =
    at && !Number.isNaN(at.getTime())
      ? `Ao vivo · Copa Streamers · ${at.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "Ao vivo · Copa Streamers";
};

const applyCopaPayload = (live) => {
  if (!live?.ok) return;
  if (live.stats) club.stats = { ...club.stats, ...live.stats };
  if (live.motto) club.motto = live.motto;
  if (live.lastMatch) club.lastMatch = live.lastMatch;
  if (live.nextMatch) club.nextMatch = live.nextMatch;
  if (live.groupTable?.some((row) => Number(row.j) > 0)) club.groupTable = live.groupTable;
  if (live.bracket?.some((round) => round.ties?.some((t) => t.home && t.home !== "A definir"))) {
    club.bracket = live.bracket;
  }
  if (live.clubs) club.clubs = { ...club.clubs, ...live.clubs };
  club.results = mergeResults(club.results, live.results);
  club.scorers = mergeStatRows(club.scorers, live.scorers);
  club.assists = mergeStatRows(club.assists, live.assists);
  paintCompetition();
  stampCopaLive(live);
};

const pullCopaLive = async () => {
  try {
    const res = await fetch("/api/copa", { cache: "no-store" });
    if (!res.ok) return;
    applyCopaPayload(await res.json());
  } catch {
    /* mantém data.js */
  }
};

pullCopaLive();
window.setInterval(pullCopaLive, 60_000);

document.getElementById("feed-grid").innerHTML = club.gallery
  .slice(0, 3)
  .map(
    (item) => `
    <a class="feed-card" href="${item.href || club.instagram}" target="_blank" rel="noreferrer">
      <img src="${item.src}" alt="${item.alt}" />
      <span>${item.caption}</span>
    </a>`
  )
  .join("");

document.getElementById("squad").innerHTML = club.squad
  .map(
    (p) => `
    <article class="player${p.photo ? " has-photo" : ""}">
      ${p.photo ? `<img class="player-photo" src="${p.photo}" alt="${p.tag}" />` : `<img class="player-photo fallback" src="assets/crest.png" alt="" />`}
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

const squadGrid = document.getElementById("squad");
const squadCards = [...squadGrid.querySelectorAll(".player")];
const setSquadNear = (card, value) => card.style.setProperty("--near", value);
const resetSquadNear = () => squadCards.forEach((card) => setSquadNear(card, "0"));
if (squadGrid && squadCards.length && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  squadGrid.addEventListener("pointermove", (event) => {
    squadCards.forEach((card) => {
      const box = card.getBoundingClientRect();
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      const falloff = Math.max(box.width, box.height) * 0.95;
      const near = Math.max(0, 1 - Math.hypot(dx, dy) / falloff);
      setSquadNear(card, near.toFixed(3));
    });
  });
  squadGrid.addEventListener("pointerleave", resetSquadNear);
}

const squadMatch = (tag) => {
  const want = String(tag).toLowerCase();
  return (
    club.squad.find((p) => p.tag.toLowerCase() === want) ||
    club.squad.find((p) => p.tag.toLowerCase().startsWith(want)) ||
    null
  );
};

const pitchMarkings = `
  <svg class="pitch-lines" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true">
    <rect x="8" y="8" width="284" height="384" rx="2" />
    <line x1="8" y1="200" x2="292" y2="200" />
    <circle cx="150" cy="200" r="46" />
    <circle class="pitch-spot" cx="150" cy="200" r="2.5" />
    <rect x="70" y="8" width="160" height="58" />
    <rect x="112" y="8" width="76" height="24" />
    <circle class="pitch-spot" cx="150" cy="50" r="2.5" />
    <rect x="70" y="334" width="160" height="58" />
    <rect x="112" y="368" width="76" height="24" />
    <circle class="pitch-spot" cx="150" cy="350" r="2.5" />
    <path d="M8 20 A 12 12 0 0 0 20 8" />
    <path d="M292 20 A 12 12 0 0 1 280 8" />
    <path d="M8 380 A 12 12 0 0 1 20 392" />
    <path d="M292 380 A 12 12 0 0 0 280 392" />
  </svg>`;

const pitchSlots = club.formation.slots
  .map((slot) => {
    const kind = slot.pos === "GOL" ? "gk" : slot.pos === "TEC" ? "coach" : "";
    const player = squadMatch(slot.tag);
    const num = player && player.number > 0 ? String(player.number).padStart(2, "0") : "";
    const token = slot.pos === "TEC" ? "TEC" : num || slot.pos;
    return `
    <div class="slot ${kind}" style="left:${slot.x}%;top:${slot.y}%">
      <div class="dot"><i>${token}</i></div>
      <span><small>${slot.pos === "TEC" ? "TEC" : slot.pos}</small><b>${slot.tag}</b></span>
    </div>`;
  })
  .join("");

const startersOnPitch = new Set(
  club.formation.slots.map((slot) => squadMatch(slot.tag)?.tag).filter(Boolean)
);
const benchPlayers = club.squad.filter((p) => !startersOnPitch.has(p.tag));

const pitchBench = benchPlayers.length
  ? `
  <aside class="pitch-bench" aria-label="Banco de reservas">
    <p>Banco</p>
    <ul>
      ${benchPlayers
        .map(
          (p) => `
        <li>
          ${
            p.photo
              ? `<img src="${p.photo}" alt="" />`
              : `<img class="fallback" src="assets/crest.png" alt="" />`
          }
          <span><b>${p.tag}</b><small>${p.pos !== "—" ? p.pos : "TEC"}</small></span>
        </li>`
        )
        .join("")}
    </ul>
  </aside>`
  : "";

document.getElementById("pitch").innerHTML = pitchMarkings + pitchSlots + pitchBench;

const mvpPoll = club.mvp;
const mvpKey = `mvp-vote:${mvpPoll.id}`;
const mvpCandidates = club.squad.filter((p) => p.pos !== "—");

function isNamedTeam(name) {
  return Boolean(name) && name !== "A definir";
}

function mvpMatchup() {
  const next = club.nextMatch || {};
  const last = club.lastMatch || {};
  if (isNamedTeam(next.opponent)) {
    return {
      opponent: next.opponent,
      round: String(next.competition || "").split("·")[0].trim(),
    };
  }
  if (isNamedTeam(last.opponent)) {
    return {
      opponent: last.opponent,
      round: String(last.note || "").split("·")[0].trim(),
    };
  }
  return { opponent: null, round: "" };
}

function mvpMatchLine() {
  const { opponent, round } = mvpMatchup();
  const hours = club.mvp?.durationHours || 2;
  if (!opponent) {
    return club.mvp?.match
      ? `${club.mvp.match}. Duração da votação: ${hours} horas.`
      : `Votação de MVP. Adversário a definir. Duração da votação: ${hours} horas.`;
  }
  const roundBit = round ? `${round} · ` : "";
  return `${roundBit}Votação de MVP do jogo contra o ${opponent}. Duração da votação: ${hours} horas.`;
}

function paintMvpCopy() {
  const el = document.getElementById("mvp-copy");
  if (el) el.textContent = mvpMatchLine();
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

const mvpVotesOf = (tag) => Number(mvpState.totals[tag]) || 0;

const mvpRatingOf = (player) => {
  const n = Number(String(player?.rating || "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const renderMvp = () => {
  const grid = document.getElementById("mvp-grid");
  const status = document.getElementById("mvp-status");
  const clock = document.getElementById("mvp-clock");
  const startBtn = document.getElementById("mvp-start");
  const pauseBtn = document.getElementById("mvp-pause");
  const resumeBtn = document.getElementById("mvp-resume");
  const closeBtn = document.getElementById("mvp-close");
  const resetBtn = document.getElementById("mvp-reset");
  if (!grid || !status) return;
  const locked = mvpState.voted || !mvpState.open;
  const showCounts = Boolean(mvpAdminPin);
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
    if (closeBtn) closeBtn.disabled = !mvpState.started || (!mvpState.open && !mvpState.paused);
    if (resetBtn) resetBtn.disabled = false;
  }
  const ranked = mvpState.started
    ? [...mvpCandidates].sort((a, b) => {
        const voteDiff = mvpVotesOf(b.tag) - mvpVotesOf(a.tag);
        if (voteDiff) return voteDiff;
        const rateDiff = mvpRatingOf(b) - mvpRatingOf(a);
        if (rateDiff) return rateDiff;
        return String(a.tag).localeCompare(String(b.tag), "pt-BR");
      })
    : [...mvpCandidates];
  const topVotes = mvpVotesOf(ranked[0]?.tag);
  const uniqueLead = mvpState.started && topVotes > 0 ? ranked[0] : null;
  const votingOver = mvpState.started && !mvpState.open && !mvpState.paused;
  const plural = mvpState.total === 1 ? "voto" : "votos";
  if (!mvpState.started) {
    const { opponent } = mvpMatchup();
    status.textContent = opponent
      ? `Aguardando o Bala abrir a urna de MVP do jogo contra o ${opponent}.`
      : `Aguardando o Bala abrir a urna. Duração da votação: ${mvpPoll.durationHours} horas.`;
  } else if (mvpState.paused) {
    status.textContent = showCounts
      ? `Votação pausada. ${mvpState.total} ${plural} até agora.`
      : "Votação pausada.";
  } else if (mvpState.voted) {
    status.textContent = showCounts
      ? `Voto registrado em ${mvpState.mine}. ${mvpState.total} ${plural} no total.`
      : `Voto registrado em ${mvpState.mine}.`;
  } else if (mvpState.open) {
    status.textContent = showCounts
      ? `${mvpState.total} ${plural} até agora. Escolhe um e confirma.`
      : "Escolhe um e confirma.";
  } else if (uniqueLead) {
    status.textContent = showCounts
      ? `Votação encerrada. Vencedor: ${uniqueLead.tag}. ${mvpState.total} ${plural} no total.`
      : `Votação encerrada. Vencedor: ${uniqueLead.tag}.`;
  } else {
    status.textContent = showCounts
      ? `Votação encerrada. ${mvpState.total} ${plural} no total.`
      : "Votação encerrada.";
  }
  grid.innerHTML = ranked
    .map((p) => {
      const n = mvpVotesOf(p.tag);
      const pct = mvpPct(p.tag);
      const photo = p.photo || "assets/crest.png";
      const mine = mvpState.mine === p.tag;
      const lead = uniqueLead && uniqueLead.tag === p.tag;
      const winner = lead && votingOver;
      const badge = winner
        ? `<span class="mvp-badge">Vencedor da votação de MVP</span>`
        : lead
          ? `<span class="mvp-badge is-lead">Na frente</span>`
          : "";
      return `
        <article class="mvp-card${mine ? " is-mine" : ""}${lead ? " is-lead" : ""}${winner ? " is-winner" : ""}">
          ${badge}
          <img src="${photo}" alt="" class="${p.photo ? "" : "fallback"}" />
          <div>
            <b>${p.tag}</b>
            <small>${p.pos}</small>
            <span class="mvp-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
            <em>${showCounts ? `${n} · ${pct}%` : `${pct}%`}</em>
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
  if ("voted" in data) {
    mvpState.voted = Boolean(data.voted);
    mvpState.mine = data.mine || null;
    if (mvpState.voted && mvpState.mine) localStorage.setItem(mvpKey, mvpState.mine);
    else localStorage.removeItem(mvpKey);
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
document.getElementById("mvp-close")?.addEventListener("click", () => {
  if (!window.confirm("Encerrar a votação agora? Ninguém mais vota. Os votos ficam.")) return;
  postMvpAdmin("close").catch(() => {});
});
document.getElementById("mvp-reset")?.addEventListener("click", () => {
  if (!window.confirm("Recomeçar do zero? Apaga todos os votos e volta a urna pro começo.")) return;
  postMvpAdmin("reset").catch(() => {});
});

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
const siteFooter = document.querySelector("footer");
const placeCreator = () => {
  if (!creatorBtn) return;
  const footerBox = siteFooter?.getBoundingClientRect();
  const footerInView = Boolean(footerBox && footerBox.top < window.innerHeight && footerBox.bottom > 0);
  creatorBtn.classList.toggle("is-faded", window.scrollY > 24 && !footerInView);
  creatorBtn.classList.toggle("is-at-footer", footerInView);
};
placeCreator();
window.addEventListener("scroll", placeCreator, { passive: true });
window.addEventListener("resize", placeCreator);
