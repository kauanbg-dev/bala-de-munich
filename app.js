const club = window.CLUB;

const mottoEl = document.getElementById("motto");
if (mottoEl) mottoEl.textContent = club.motto;
const instaEl = document.getElementById("instagram");
if (instaEl) instaEl.href = club.instagram;
const discordEl = document.getElementById("discord");
if (discordEl) discordEl.href = club.discord;

let placarState = { live: false, done: false, us: 0, them: 0 };

const isBalaName = (name) => /bala de munich/i.test(String(name || ""));

const finalTieOf = () => {
  const round = (club.bracket || []).find((row) => /grande final/i.test(row.round));
  return round?.ties?.find((tie) => tie.us) || round?.ties?.[0] || null;
};

const applyPlacarToClub = () => {
  if (!placarState.live && !placarState.done) return;
  const tie = overlayFinalTie(finalTieOf());
  if (!tie) return;
  const rival = isBalaName(tie.home) ? tie.away : tie.home;
  if (placarState.live) {
    club.motto = `Grande final ao vivo. Bala ${placarState.us}–${placarState.them} ${rival}.`;
    club.nextMatch = {
      opponent: rival,
      competition: "Grande final · MD5",
      date: `ao vivo · ${placarState.us}–${placarState.them}`,
      venue: "Mata-mata",
    };
  } else {
    club.motto = `Final ${placarState.us}–${placarState.them} contra o ${rival}.`;
  }
};

const overlayFinalTie = (tie) => {
  if (!tie || !(tie.final || tie.id === "ff-0")) return tie;
  if (!placarState.live && !placarState.done) return tie;
  const balaHome = isBalaName(tie.home);
  return {
    ...tie,
    hs: balaHome ? placarState.us : placarState.them,
    as: balaHome ? placarState.them : placarState.us,
    live: Boolean(placarState.live),
    date: placarState.live ? "Ao vivo" : "Encerrada",
  };
};

const paintFinalDay = () => {
  const el = document.getElementById("final-day");
  if (!el) return;
  const tie = finalTieOf();
  let us = null;
  let them = null;
  let live = false;
  let done = false;
  if (placarState.live || placarState.done) {
    us = placarState.us;
    them = placarState.them;
    live = Boolean(placarState.live);
    done = Boolean(placarState.done);
  } else if (tie && tie.hs != null && tie.as != null) {
    const balaHome = isBalaName(tie.home);
    us = balaHome ? tie.hs : tie.as;
    them = balaHome ? tie.as : tie.hs;
    live = Boolean(tie.live);
    done = !live;
  }
  const hasScore = us != null;
  el.hidden = false;
  el.classList.toggle("is-live", live);
  el.classList.toggle("is-done", done && hasScore);
  const kicker = document.getElementById("final-day-kicker");
  if (kicker) kicker.textContent = live ? "Ao vivo" : done && hasScore ? "Série encerrada" : "Hoje · 16/09 · 18h";
  const vs = document.getElementById("final-day-vs");
  const board = document.getElementById("final-day-board");
  const usEl = document.getElementById("final-day-us");
  const themEl = document.getElementById("final-day-them");
  if (usEl) usEl.textContent = String(us ?? 0);
  if (themEl) themEl.textContent = String(them ?? 0);
  if (board) board.hidden = !hasScore;
  if (vs) vs.hidden = hasScore;
  const when = document.getElementById("final-day-when");
  if (when) {
    if (live) when.textContent = "placar da série";
    else if (done && hasScore) when.textContent = `${us}–${them}`;
    else if (club.nextMatch?.date) {
      const raw = String(club.nextMatch.date);
      when.textContent = raw.includes("·") ? raw.split("·").pop().trim() : raw;
    }
  }
};

const paintCompetition = () => {
  applyPlacarToClub();
  const s = club.stats;
  const strip = document.getElementById("stat-strip");
  if (strip) {
    strip.innerHTML = [
      ["Grupo C", `${s.groupPos}`],
      ["Pontos", s.points],
      ["Séries", `${s.seriesWins}–${s.seriesLosses}`],
      ["Gols (grupos)", `${s.goalsFor} / ${s.goalsAgainst}`],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
      .join("");
  }

  const motto = document.getElementById("motto");
  if (motto) motto.textContent = club.motto;

  const clubMeta = (name) => club.clubs[name] || { owner: "–", tbd: true };

  const teamMark = (name, extra = "") => {
    const t = clubMeta(name);
    const crest = t.crest
      ? `<img class="team-crest" src="${t.crest}" alt="" />`
      : `<span class="team-crest is-empty" aria-hidden="true"></span>`;
    return `<span class="team-mark${t.tbd ? " is-tbd" : ""}">${crest}<span>${name}${extra}</span></span>`;
  };

  const last = document.getElementById("last-match");
  if (last) {
    last.innerHTML = `
    <span>Última série</span>
    <strong>${club.lastMatch.score}</strong>
    <p>vs ${teamMark(club.lastMatch.opponent)}${club.lastMatch.note ? ` · ${club.lastMatch.note}` : ""}</p>
  `;
  }

  const next = document.getElementById("next-match");
  if (next) {
    next.innerHTML = `
    <span>${/hoje|ao vivo/i.test(club.nextMatch.date) || /16\/09/.test(club.nextMatch.date) ? (placarState.live ? "Ao vivo" : "Hoje") : "Próximo jogo"} · ${club.nextMatch.venue}</span>
    <strong>vs ${teamMark(club.nextMatch.opponent)}</strong>
    <p>${club.nextMatch.competition} · ${club.nextMatch.date}</p>
  `;
  }
  paintFinalDay();
  paintMvpCopy();

  const chaveSide = (name, score, win, played) => {
    const t = clubMeta(name);
    const crest = t.crest
      ? `<img class="chave-crest" src="${t.crest}" alt="" />`
      : `<span class="chave-crest is-empty" aria-hidden="true"></span>`;
    const bg = t.crest ? `<img src="${t.crest}" alt="" />` : "";
    const loser = played && !win;
    return `
    <div class="chave-side${win ? " is-win" : ""}${loser ? " is-out" : ""}${t.us ? " is-us" : ""}${t.tbd ? " is-tbd" : ""}">
      <span class="chave-bg" aria-hidden="true">${bg}</span>
      <span class="chave-rail" aria-hidden="true"></span>
      <div class="chave-team">${crest}<span class="chave-txt"><b>${name}</b><small>${t.owner}</small></span></div>
      <span class="chave-score">${score}</span>
    </div>`;
  };

  const chaveCard = (round) => (raw) => {
    const t = overlayFinalTie(raw);
    const live = Boolean(t.live);
    const played = !live && t.hs !== null && t.as !== null;
    const showScore = live || played;
    const homeWin = played && t.hs > t.as;
    const awayWin = played && t.as > t.hs;
    return `
      <article class="chave-match${t.us ? " is-us" : ""}${t.final ? " is-final" : ""}${played ? " is-done" : ""}${live ? " is-live" : ""}" id="${t.id}">
      <header class="chave-top">
        <span class="chave-round">
          ${t.final ? `<i class="chave-cup" aria-hidden="true"></i>` : ""}
          ${round.round}
        </span>
        <span class="chave-state">${live ? "Ao vivo" : played ? "Encerrada" : "A disputar"}</span>
      </header>
      ${chaveSide(t.home, showScore ? t.hs : "–", homeWin, played)}
      ${chaveSide(t.away, showScore ? t.as : "–", awayWin, played)}
      <footer class="chave-foot">
        <span>${t.date}</span>
        ${t.us ? `<span class="chave-flag">Bala</span>` : ""}
      </footer>
    </article>`;
  };

  const doneCount = club.bracket.flatMap((r) => r.ties).filter((t) => t.hs !== null && !t.live).length;
  const openCount = club.bracket.flatMap((r) => r.ties).length - doneCount;
  const legend = document.getElementById("chave-legend");
  if (legend) legend.innerHTML = `<span class="is-done">${doneCount} encerradas</span><span>${openCount} a disputar</span>`;

  const bracket = document.getElementById("bracket");
  if (bracket) {
    bracket.innerHTML = `
  <svg class="chave-wires" aria-hidden="true"></svg>
  <div class="chave-cols">
    ${club.bracket
      .map(
        (round) => `
      <span class="chave-lab chave-lab-${round.key}"><i>${round.n}</i>${round.round}</span>
      ${round.ties.map(chaveCard(round)).join("")}`
      )
      .join("")}
  </div>`;

    drawChaveWires();
    document.querySelectorAll("#bracket img").forEach((img) => img.addEventListener("load", drawChaveWires, { once: true }));
  }

  const standings = document.getElementById("standings");
  if (standings) {
    standings.innerHTML = club.groupTable
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
  }

  const scorers = document.getElementById("scorers");
  if (scorers) {
    scorers.innerHTML = club.scorers
    .map((p) => `<li><b>${p.tag}</b> <span>${p.pos}</span> <strong>${p.goals}</strong></li>`)
    .join("");
  }

  const assists = document.getElementById("assists");
  if (assists) {
    assists.innerHTML = club.assists
    .map((p) => `<li><b>${p.tag}</b> <span>${p.pos}</span> <strong>${p.assists}</strong></li>`)
    .join("");
  }

  const results = document.getElementById("results");
  if (results) {
    results.innerHTML = club.results
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
  }

  paintFriendlies(clubMeta);
  paintLiveNow();
};

let amiExpanded = false;
const AMI_PREVIEW = 6;
// O histórico do data.js é escrito na mão e nunca vem da Copa. Guardamos ele
// aqui porque o sync ao vivo sobrescreve club.friendlies a cada 60s.
const AMI_HISTORY = Array.isArray(club.friendlies) ? club.friendlies.slice() : [];

function paintFriendlies(clubMeta) {
  const grid = document.getElementById("ami-grid");
  const strip = document.getElementById("ami-strip");
  const more = document.getElementById("ami-more");
  if (!grid || !strip) return;

  const list = Array.isArray(club.friendlies) ? club.friendlies : [];

  if (!list.length) {
    strip.innerHTML = "";
    if (more) more.hidden = true;
    grid.innerHTML = `<p class="ami-empty">Nenhum amistoso registrado ainda. O próximo jogo do Bala fora da Copa entra aqui sozinho, com placar, craque e goleadores.</p>`;
    return;
  }

  const valid = list.filter((m) => m.result);
  const count = (letter) => valid.filter((m) => m.result === letter).length;
  const goals = valid.reduce(
    (acc, m) => ({ for: acc.for + (Number(m.us) || 0), against: acc.against + (Number(m.them) || 0) }),
    { for: 0, against: 0 }
  );

  strip.innerHTML = [
    ["Jogos", valid.length],
    ["Vitórias", count("W")],
    ["Empates", count("D")],
    ["Derrotas", count("L")],
    ["Gols", `${goals.for} / ${goals.against}`],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join("");

  const label = { W: "Vitória", D: "Empate", L: "Derrota" };
  const side = (name, crest, score, winner) => `
      <div class="ami-side${winner ? " is-win" : ""}">
        ${
          crest
            ? `<img class="ami-crest" src="${crest}" alt="" loading="lazy" />`
            : `<span class="ami-crest is-empty" aria-hidden="true"></span>`
        }
        <b>${name}</b>
        <span class="ami-score">${score}</span>
      </div>`;

  const ourCrest = clubMeta("Bala de Munich").crest || "assets/crest.png";
  const shown = amiExpanded ? list : list.slice(0, AMI_PREVIEW);

  grid.innerHTML = shown
    .map((m) => {
      const done = Boolean(m.result);
      const foot = [
        m.star ? `<span class="ami-star">Craque · ${m.star}</span>` : "",
        m.scorers?.length
          ? `<span class="ami-goals">${m.scorers
              .map((g) => `${g.name}${g.goals > 1 ? ` <i>x${g.goals}</i>` : ""}`)
              .join(", ")}</span>`
          : "",
      ].filter(Boolean);
      return `
      <article class="ami-card${done ? ` is-${m.result}` : " is-next"}">
        <header class="ami-top">
          <span class="ami-kind">${m.date || "Amistoso"}</span>
          <span class="ami-tag">${done ? label[m.result] : "A jogar"}</span>
        </header>
        ${side("Bala de Munich", ourCrest, done ? m.us : "–", m.result === "W")}
        ${side(m.opponent, m.crest, done ? m.them : "–", m.result === "L")}
        <footer class="ami-foot">
          ${foot.join("")}
          <span class="ami-format">${m.format || "11v11"}</span>
        </footer>
      </article>`;
    })
    .join("");

  if (more) {
    more.hidden = list.length <= AMI_PREVIEW;
    more.textContent = amiExpanded
      ? "Mostrar menos"
      : `Ver todos os ${list.length} amistosos`;
  }
}

// Nem a Copa nem a EA publicam partida em andamento: o placar só nasce depois
// que o jogo acaba. Então "ao vivo" aqui é deduzido de dois sinais concretos.
// Um: série oficial com horário já iniciado e ainda sem placar. Dois: amistoso
// que entrou no acervo há poucos minutos — no Pro Clubs os jogos são emendados,
// então resultado recém-chegado quer dizer que o time ainda está em campo.
const LIVE_MAX = 3;
// Quem está em live (Kick/Twitch) entra na faixa do hero. A lista só enche
// depois do /api/lives em lives.js.
// Uma partida leva uns 15 min de relógio real. Meia hora sem nada novo já é
// sessão encerrada, não intervalo entre jogos.
const LIVE_FRESH_MS = 28 * 60 * 1000;
const LIVE_GAP_MS = 40 * 60 * 1000;
const LIVE_OFICIAL_MS = 3 * 60 * 60 * 1000;

function agoLabel(ms) {
  const min = Math.round(ms / 60_000);
  if (min < 2) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h}h${String(min % 60).padStart(2, "0")}`;
}

// Puxa a sessão de agora: o amistoso mais recente, se for fresco, e os que
// vierem colados nele. Parar no primeiro buraco grande evita varrer o acervo
// inteiro de uma noite antiga.
function liveSession(list, now) {
  const out = [];
  let ref = now;
  for (const m of list) {
    if (!m.live || !m.iso || !m.result) continue;
    const at = Date.parse(m.iso);
    if (!Number.isFinite(at)) continue;
    if (ref - at > (out.length ? LIVE_GAP_MS : LIVE_FRESH_MS)) break;
    out.push({ ...m, at });
    ref = at;
    if (out.length >= LIVE_MAX) break;
  }
  return out;
}

function liveOficial(now) {
  return (club.bracket || [])
    .flatMap((round) => (round.ties || []).map((t) => ({ ...t, round: round.round })))
    .filter((t) => {
      const view = overlayFinalTie(t);
      if (!view.us) return false;
      if (view.live) return true;
      if (!view.iso || view.hs != null || view.as != null) return false;
      const at = Date.parse(view.iso);
      return Number.isFinite(at) && now >= at && now - at <= LIVE_OFICIAL_MS;
    })
    .map((t) => {
      const view = overlayFinalTie(t);
      return { ...view, at: Date.parse(view.iso) || now };
    });
}

function liveOffCard(ourCrest) {
  return `
      <div class="live-off">
        <img src="${ourCrest}" alt="" loading="lazy" />
        <div>
          <b>Ninguém em campo agora.</b>
          <span>Quando o Bala entrar em partida, o placar sobe aqui sozinho, amistoso ou Copa.</span>
        </div>
      </div>`;
}

function streamersNow() {
  return Array.isArray(window.streamersOnAir) ? window.streamersOnAir : [];
}

function streamerCards() {
  return streamersNow()
    .map(
      (p) => `
      <a class="live-card is-stream is-${p.kind}" href="/lives?watch=${encodeURIComponent(p.tag)}" data-live-tag="${p.tag}">
        <span class="live-when">${p.label}</span>
        <div class="live-teams">
          <img src="${p.photo || "assets/crest.png"}" alt="" loading="lazy" />
          <b>${p.tag}</b>
        </div>
        <span class="live-vs">${p.title || "Ao vivo agora"}</span>
        <span class="live-tag">Ao vivo</span>
      </a>`
    )
    .join("");
}

function paintLiveNow() {
  const band = document.getElementById("live-band");
  const row = document.getElementById("live-row");
  const title = document.getElementById("live-title");
  const more = document.getElementById("live-more");
  if (!band || !row) return;

  const now = Date.now();
  const ourCrest = club.clubs?.["Bala de Munich"]?.crest || "assets/crest.png";
  const oficial = liveOficial(now);
  const sessao = liveSession(Array.isArray(club.friendlies) ? club.friendlies : [], now);
  const emCampo = oficial.length > 0 || sessao.length > 0;
  const noAr = streamersNow().length > 0;

  band.classList.toggle("is-off", !emCampo && !noAr);
  if (title) {
    title.textContent = emCampo ? "Bala em campo agora" : noAr ? "Elenco ao vivo" : "Bala ao vivo";
  }
  if (more) {
    more.href = emCampo ? "/confrontos" : noAr ? "/lives" : "/amistosos";
    more.textContent = emCampo ? "Ver chave" : noAr ? "Ver lives" : "Ver amistosos";
  }

  if (!emCampo && noAr) {
    row.innerHTML = streamerCards();
    return;
  }

  if (!emCampo) {
    row.innerHTML = liveOffCard(ourCrest);
    return;
  }

  const crestOf = (crest) =>
    crest
      ? `<img src="${crest}" alt="" loading="lazy" />`
      : `<span class="live-crest is-empty" aria-hidden="true"></span>`;

  const label = { W: "Vitória", D: "Empate", L: "Derrota" };
  const cards = [
    // Série oficial em andamento não tem placar parcial em lugar nenhum, então
    // o card mostra que está rolando e a que horas começou, sem inventar número.
    ...oficial.map((t) => {
      const usHome = t.home === "Bala de Munich";
      const rival = usHome ? t.away : t.home;
      const us = usHome ? t.hs : t.as;
      const them = usHome ? t.as : t.hs;
      const hasScore = us != null && them != null;
      return `
      <article class="live-card is-on">
        <span class="live-when">${t.round} · ${hasScore ? "ao vivo" : `começou ${agoLabel(now - t.at)}`}</span>
        <div class="live-teams${hasScore ? "" : " is-open"}">
          ${crestOf(ourCrest)}
          <b>${hasScore ? us : "·"}</b><i>${hasScore ? "–" : "vs"}</i><b>${hasScore ? them : "·"}</b>
          ${crestOf(club.clubs?.[rival]?.crest)}
        </div>
        <span class="live-vs">vs ${rival}</span>
        <span class="live-tag">Ao vivo</span>
      </article>`;
    }),
    ...sessao.map(
      (m) => `
      <article class="live-card is-${m.result}">
        <span class="live-when">Amistoso · ${agoLabel(now - m.at)}</span>
        <div class="live-teams">
          ${crestOf(ourCrest)}
          <b>${m.us}</b><i>–</i><b>${m.them}</b>
          ${crestOf(m.crest)}
        </div>
        <span class="live-vs">vs ${m.opponent}</span>
        <span class="live-tag">${label[m.result]}</span>
      </article>`
    ),
  ];

  row.innerHTML = cards.slice(0, LIVE_MAX).join("") + streamerCards();
}

window.paintLiveNow = paintLiveNow;
paintLiveNow();

// O estado da faixa vence sozinho com o relógio, sem depender da Copa mandar
// dado novo: sem este tique, "há 3 min" ficaria congelado na tela.
window.setInterval(paintLiveNow, 30_000);

document.getElementById("ami-more")?.addEventListener("click", () => {
  amiExpanded = !amiExpanded;
  paintCompetition();
  if (!amiExpanded) document.getElementById("amistosos")?.scrollIntoView({ block: "start" });
});

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
  // Ao vivo só traz jogo depois da data de corte, então ele sempre vem antes do
  // histórico: dá pra emendar sem reordenar nada.
  if (Array.isArray(live.friendlies)) club.friendlies = [...live.friendlies, ...AMI_HISTORY];
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

const applyPlacarData = (data) => {
  if (!data || data.error) return;
  placarState = {
    live: Boolean(data.live),
    done: Boolean(data.done),
    us: Number(data.us) || 0,
    them: Number(data.them) || 0,
  };
};

const paintAdmPlacar = () => {
  const us = document.getElementById("adm-placar-us");
  const them = document.getElementById("adm-placar-them");
  const hint = document.getElementById("adm-placar-hint");
  const liveBtn = document.getElementById("adm-placar-live");
  const endBtn = document.getElementById("adm-placar-end");
  if (us) us.textContent = String(placarState.us);
  if (them) them.textContent = String(placarState.them);
  if (liveBtn) liveBtn.disabled = Boolean(placarState.live);
  if (endBtn) endBtn.disabled = !placarState.live;
  if (hint && mvpAdminPin) {
    hint.classList.remove("is-error");
    hint.textContent = placarState.live
      ? `Ao vivo ${placarState.us}–${placarState.them}. O público vê na home.`
      : placarState.done
        ? `Série encerrada em ${placarState.us}–${placarState.them}.`
        : "Ainda sem placar no ar. Toca em Ao vivo quando o MD5 começar.";
  }
};

const pullPlacar = async () => {
  try {
    const res = await fetch("/api/placar", { cache: "no-store" });
    if (!res.ok) return;
    applyPlacarData(await res.json());
    paintCompetition();
    paintAdmPlacar();
  } catch {
    /* mantém o último placar */
  }
};

pullPlacar();
window.setInterval(pullPlacar, 8_000);

const feedCode = (href) => {
  const match = String(href || "").match(/\/(?:p|reel|tv)\/([^/?#]+)/i);
  return match ? match[1] : "";
};

// Se a API atrasar (Feedframer diário / Instagram 429), os posts novos do
// data.js continuam na frente até a API trazer o mesmo shortcode.
const feedLocalByCode = () => {
  const map = new Map();
  for (const item of club.gallery || []) {
    const code = feedCode(item.href);
    if (code) map.set(code, item);
  }
  return map;
};

const withGalleryMeta = (item) => {
  const local = feedLocalByCode().get(feedCode(item.href));
  if (!local) return item;
  return {
    ...item,
    contain: item.contain || local.contain,
    src: item.src || local.src,
  };
};

const mergeFeedWithGallery = (apiPosts) => {
  const apiCodes = new Set((apiPosts || []).map((item) => feedCode(item.href)).filter(Boolean));
  const leading = [];
  for (const item of club.gallery || []) {
    const code = feedCode(item.href);
    if (code && apiCodes.has(code)) break;
    if (code && !apiCodes.has(code)) leading.push(item);
    else break;
  }
  return [...leading, ...(apiPosts || [])].map(withGalleryMeta);
};

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const paintFeedFonte = (fonte) => {
  const el = document.getElementById("feed-fonte");
  if (!el) return;
  const admin = new URLSearchParams(window.location.search).has("admin");
  if (!admin) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent =
    fonte === "instagram+feedframer"
      ? "Admin · Instagram + Feedframer"
      : fonte === "instagram"
        ? "Admin · ao vivo pelo Instagram"
        : fonte === "feedframer"
          ? "Admin · ao vivo pelo Feedframer"
          : fonte === "meta"
            ? "Admin · ao vivo pela Meta"
            : "Admin · fotos de piso (data.js)";
};

const feedContain = (item) => {
  if (item?.contain) return true;
  return feedCode(item?.href) === "DdSoyFrjaG3";
};

const paintFeed = (posts, fonte) => {
  const grid = document.getElementById("feed-grid");
  if (!grid) return;
  grid.innerHTML = posts
    .slice(0, 3)
    .map(
      (item) => `
    <a class="feed-card${feedContain(item) ? " is-contain" : ""}" href="${esc(item.href || club.instagram)}" target="_blank" rel="noreferrer">
      <img src="${esc(item.src)}" alt="${esc(item.alt)}" loading="lazy" referrerpolicy="no-referrer" />
      ${item.video ? `<i class="feed-play" aria-hidden="true"></i>` : ""}
      <span>${esc(item.caption)}</span>
    </a>`
    )
    .join("");
  paintFeedFonte(fonte);
};

paintFeed(club.gallery, "piso");

// As fotos do data.js são o piso: só saem da tela se o Instagram responder.
const pullInstaFeed = async () => {
  try {
    const res = await fetch("/api/feed", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.ok && Array.isArray(data.posts) && data.posts.length) {
      paintFeed(mergeFeedWithGallery(data.posts), data.fonte || "feedframer");
    }
  } catch {
    /* mantém data.js */
  }
};

pullInstaFeed();
window.setInterval(pullInstaFeed, 3 * 60_000);

const squadEl = document.getElementById("squad");
if (squadEl) {
  squadEl.innerHTML = club.squad
  .map(
    (p) => `
    <article class="player${p.photo ? " has-photo" : ""}" data-tag="${p.tag}">
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
}

window.paintSquadLive = () => {
  const air = new Map((window.streamersOnAir || []).map((c) => [c.tag, c]));
  document.querySelectorAll("#squad .player[data-tag]").forEach((card) => {
    const hit = air.get(card.getAttribute("data-tag"));
    card.classList.toggle("is-live", Boolean(hit));
    card.classList.toggle("is-twitch", hit?.kind === "twitch");
    card.classList.toggle("is-kick", hit?.kind === "kick");
    let pill = card.querySelector(".player-live");
    if (hit && !pill) {
      pill = document.createElement("span");
      pill.className = "player-live";
      pill.textContent = "Ao vivo";
      card.appendChild(pill);
    } else if (!hit && pill) {
      pill.remove();
    }
  });
};

const streamerFromSquad = (player) => {
  try {
    const url = new URL(player.live, window.location.origin);
    const host = url.hostname.replace(/^www\./, "");
    const slug = url.pathname.replace(/^\//, "").split("/")[0];
    if (!slug) return null;
    if (host.includes("kick.com")) return { ...player, kind: "kick", slug, label: "Kick" };
    if (host.includes("twitch.tv")) return { ...player, kind: "twitch", slug, label: "Twitch" };
  } catch {
    /* URL vazia ou quebrada */
  }
  return null;
};

const pullStreamers = async () => {
  const channels = (club.squad || []).map(streamerFromSquad).filter(Boolean);
  const kick = channels.filter((c) => c.kind === "kick").map((c) => c.slug);
  const twitch = channels.filter((c) => c.kind === "twitch").map((c) => c.slug);
  if (!kick.length && !twitch.length) return;
  try {
    const q = new URLSearchParams();
    if (kick.length) q.set("c", kick.join(","));
    if (twitch.length) q.set("t", twitch.join(","));
    const res = await fetch(`/api/lives?${q}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const map = data?.live || {};
    window.streamersOnAir = channels
      .map((c) => {
        const slug = String(c.slug).toLowerCase();
        const hit = map[`${c.kind}:${slug}`] || map[slug];
        return hit?.live ? { ...c, onAir: true, title: hit.title } : null;
      })
      .filter(Boolean);
    paintLiveNow();
    window.paintSquadLive?.();
    window.paintHeroLive?.();
  } catch {
    /* faixa fica no aviso vazio */
  }
};

pullStreamers();
window.setInterval(pullStreamers, 45_000);

const squadGrid = document.getElementById("squad");
const squadCards = squadGrid ? [...squadGrid.querySelectorAll(".player")] : [];
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

const faceOf = (player, extraClass = "") => {
  const cls = ["face", extraClass, player?.photo ? "" : "fallback"].filter(Boolean).join(" ");
  const src = player?.photo || "assets/crest.png";
  return `<img class="${cls}" src="${src}" alt="" loading="lazy" />`;
};

const pitchSlots = club.formation.slots
  .map((slot) => {
    const kind = slot.pos === "GOL" ? "gk" : slot.pos === "TEC" ? "coach" : "";
    const player = squadMatch(slot.tag);
    const num = player && player.number > 0 ? String(player.number).padStart(2, "0") : "";
    const badge = player?.rating || (slot.pos === "TEC" ? "TEC" : num);
    return `
    <div class="slot ${kind}" style="left:${slot.x}%;top:${slot.y}%">
      <div class="dot">
        ${faceOf(player)}
        ${badge ? `<i>${badge}</i>` : ""}
      </div>
      <span><small>${slot.pos === "TEC" ? "TEC" : slot.pos}</small><b>${player?.tag || slot.tag}</b></span>
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
          ${faceOf(p, "bench-face")}
          <span>
            <b>${p.tag}</b>
            <small>${[p.pos !== "—" ? p.pos : "TEC", p.rating].filter(Boolean).join(" · ")}</small>
          </span>
        </li>`
        )
        .join("")}
    </ul>
  </aside>`
  : "";

const pitchEl = document.getElementById("pitch");
if (pitchEl) {
  const wrap = document.createElement("div");
  wrap.className = "pitch-wrap";
  pitchEl.replaceWith(wrap);
  wrap.appendChild(pitchEl);
  pitchEl.innerHTML = pitchMarkings + pitchSlots;
  if (pitchBench) wrap.insertAdjacentHTML("beforeend", pitchBench);
}

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
  const art = /^equipe\b/i.test(opponent) ? "a" : "o";
  return `${roundBit}Votação de MVP do jogo contra ${art} ${opponent}. Duração da votação: ${hours} horas.`;
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
  degraded: false,
  remainingMs: 0,
  endsAt: null,
  out: [],
};
const mvpAdmin = document.getElementById("mvp-admin");
const mvpAdminOps = document.getElementById("mvp-admin-ops");
const isMvpAdminPage = new URLSearchParams(window.location.search).has("admin");
if (mvpAdmin && isMvpAdminPage) mvpAdmin.hidden = false;
let mvpAdminPin = isMvpAdminPage ? sessionStorage.getItem("mvp-admin-pin") || "" : "";
let mvpTimer = null;

const pad2 = (n) => String(n).padStart(2, "0");

const mvpVotesOf = (tag) => Number(mvpState.totals[tag]) || 0;

const mvpPct = (tag) => {
  if (!mvpState.total) return 0;
  return Math.round((100 * mvpVotesOf(tag)) / mvpState.total);
};

const mvpOut = () => new Set(mvpState.out || []);

const mvpIsOut = (tag) => mvpOut().has(tag);

const mvpRatingOf = (player) => {
  const n = Number(String(player?.rating || "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const clockSegments = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const parts = [
    [pad2(Math.floor(s / 3600)), "horas"],
    [pad2(Math.floor((s % 3600) / 60)), "min"],
    [pad2(s % 60), "seg"],
  ];
  return parts
    .map(([value, label]) => `<span class="mvp-seg"><b>${value}</b><small>${label}</small></span>`)
    .join('<i class="mvp-sep" aria-hidden="true">:</i>');
};

const paintMvpClock = () => {
  const clock = document.getElementById("mvp-clock");
  const stage = document.getElementById("mvp-stage");
  const live = document.getElementById("mvp-live");
  const label = document.getElementById("mvp-clock-label");
  const progress = document.getElementById("mvp-progress");
  const fullMs = (mvpPoll.durationHours || 2) * 3600 * 1000;
  const state = !mvpState.started
    ? { cls: "is-idle", pill: "Urna fechada", label: "duração da votação", ms: fullMs, bar: 0 }
    : mvpState.paused
      ? { cls: "is-paused", pill: "Pausada", label: "votação pausada", ms: mvpState.remainingMs, bar: mvpState.remainingMs / fullMs }
      : mvpState.open
        ? { cls: "is-open", pill: "Ao vivo", label: "tempo restante", ms: mvpState.remainingMs, bar: mvpState.remainingMs / fullMs }
        : { cls: "is-closed", pill: "Encerrada", label: "votação encerrada", ms: 0, bar: 0 };
  if (clock) clock.innerHTML = clockSegments(state.ms);
  if (stage) stage.className = `mvp-stage ${state.cls}`;
  if (live) {
    live.innerHTML = `<i aria-hidden="true"></i>${state.pill}`;
    live.className = `mvp-live ${state.cls}`;
  }
  if (label) label.textContent = state.label;
  if (progress) progress.style.width = `${Math.max(0, Math.min(100, state.bar * 100))}%`;
};

const renderMvp = () => {
  const grid = document.getElementById("mvp-grid");
  const status = document.getElementById("mvp-status");
  const startBtn = document.getElementById("mvp-start");
  const pauseBtn = document.getElementById("mvp-pause");
  const resumeBtn = document.getElementById("mvp-resume");
  const closeBtn = document.getElementById("mvp-close");
  const resetBtn = document.getElementById("mvp-reset");
  if (!grid || !status) return;
  const locked = !mvpState.open || mvpState.degraded;
  const showCounts = Boolean(mvpAdminPin);
  paintMvpClock();
  if (mvpAdminOps && mvpAdminPin) {
    mvpAdminOps.hidden = false;
    if (startBtn) startBtn.disabled = mvpState.started;
    if (pauseBtn) pauseBtn.disabled = !mvpState.open;
    if (resumeBtn) resumeBtn.disabled = !mvpState.paused || mvpState.remainingMs <= 0;
    if (closeBtn) closeBtn.disabled = !mvpState.started || (!mvpState.open && !mvpState.paused);
    if (resetBtn) resetBtn.disabled = false;
  }
  const chip = document.getElementById("mvp-admin-chip");
  if (chip) {
    const state = !mvpState.started
      ? { text: "Não iniciada", cls: "" }
      : mvpState.paused
        ? { text: "Pausada", cls: "is-paused" }
        : mvpState.open
          ? { text: "No ar", cls: "is-open" }
          : { text: "Encerrada", cls: "is-closed" };
    chip.textContent = state.text;
    chip.className = `mvp-admin-chip${state.cls ? ` ${state.cls}` : ""}`;
  }
  const outSet = mvpOut();
  const ranked = [...mvpCandidates].sort((a, b) => {
    const aOut = outSet.has(a.tag);
    const bOut = outSet.has(b.tag);
    if (aOut !== bOut) return aOut ? 1 : -1;
    if (!mvpState.started) return 0;
    const voteDiff = mvpVotesOf(b.tag) - mvpVotesOf(a.tag);
    if (voteDiff) return voteDiff;
    const rateDiff = mvpRatingOf(b) - mvpRatingOf(a);
    if (rateDiff) return rateDiff;
    return String(a.tag).localeCompare(String(b.tag), "pt-BR");
  });
  const eligible = ranked.filter((p) => !outSet.has(p.tag));
  const topVotes = mvpVotesOf(eligible[0]?.tag);
  const uniqueLead = mvpState.started && topVotes > 0 ? eligible[0] : null;
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
    const tally = showCounts ? ` ${mvpState.total} ${plural} no total.` : "";
    const change = mvpState.open
      ? " Clicou errado? Toca em outro pra trocar, ou em \u201cTirar meu voto\u201d."
      : "";
    status.textContent = `Voto registrado em ${mvpState.mine}.${tally}${change}`;
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
  if (mvpState.degraded) {
    status.textContent = "O banco de votos não respondeu agora. Ninguém perdeu voto — recarrega a página em instantes.";
  }
  const adminHint = document.getElementById("mvp-admin-hint");
  if (adminHint) {
    adminHint.classList.remove("is-error");
    if (!mvpAdminPin) {
      adminHint.textContent = "";
    } else if (!mvpState.started) {
      adminHint.textContent = `Urna fechada. Marca em cima quem jogou e depois toca em "Iniciar 2h".`;
    } else {
      const lead = uniqueLead ? ` · líder ${uniqueLead.tag}` : "";
      adminHint.textContent = `${mvpState.total} ${plural} contabilizados${lead}. O público só vota em quem você marcou.`;
    }
  }
  grid.className = `mvp-grid${mvpState.started ? "" : " is-idle"}`;
  const legend = document.getElementById("mvp-legend");
  if (legend) legend.hidden = outSet.size === 0;
  const playedN = mvpCandidates.filter((p) => !outSet.has(p.tag)).length;
  const outN = mvpCandidates.length - playedN;
  const outCount = document.getElementById("mvp-out-count");
  if (outCount && mvpAdminPin) {
    outCount.textContent = `${playedN} no voto · ${outN} de fora. Dourado = jogou.`;
  }
  const outList = document.getElementById("mvp-out-list");
  if (outList && mvpAdminPin) {
    outList.innerHTML = mvpCandidates
      .map((p) => {
        const played = !outSet.has(p.tag);
        return `<button type="button" class="mvp-out-chip${played ? " is-on" : ""}" data-out="${p.tag}" aria-pressed="${played}">${p.tag}</button>`;
      })
      .join("");
  }
  grid.innerHTML = ranked
    .map((p, i) => {
      const out = outSet.has(p.tag);
      const n = mvpVotesOf(p.tag);
      const pct = mvpPct(p.tag);
      const photo = p.photo || "assets/crest.png";
      const mine = mvpState.mine === p.tag;
      const lead = uniqueLead && uniqueLead.tag === p.tag;
      const winner = lead && votingOver;
      const badge = out
        ? `<span class="mvp-badge is-out">Jogador não jogou</span>`
        : winner
          ? `<span class="mvp-badge">Vencedor da votação</span>`
          : lead
            ? `<span class="mvp-badge is-lead">Na frente</span>`
            : "";
      const score = mvpState.started && !out
        ? `<div class="mvp-score">
              <strong>${pct}<i>%</i></strong>
              ${showCounts ? `<span>${n} ${n === 1 ? "voto" : "votos"}</span>` : ""}
            </div>
            <span class="mvp-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>`
        : "";
      const label = out
        ? "Não jogou"
        : mine
          ? mvpState.open
            ? "Tirar meu voto"
            : "Seu voto"
          : !mvpState.started
            ? "Aguardando"
            : mvpState.paused
              ? "Pausada"
              : mvpState.open
                ? "Votar"
                : "Encerrada";
      return `
        <article class="mvp-card${mine ? " is-mine" : ""}${lead ? " is-lead" : ""}${winner ? " is-winner" : ""}${out ? " is-out" : ""}">
          <span class="mvp-rank">${out ? "—" : mvpState.started ? `${eligible.findIndex((x) => x.tag === p.tag) + 1}º` : p.number ? `#${p.number}` : "—"}</span>
          <span class="mvp-face"><img src="${photo}" alt="" loading="lazy" class="${p.photo ? "" : "fallback"}" /></span>
          <div class="mvp-body">
            ${badge}
            <b>${p.tag}</b>
            <small>${out ? "Jogador não jogou" : p.pos}</small>
            ${score}
            ${mvpAdminPin ? `<button type="button" class="mvp-play${out ? "" : " is-on"}" data-out="${p.tag}">${out ? "Marcar que jogou" : "Tirou do jogo"}</button>` : ""}
            <button type="button" class="${mine && mvpState.open && !out ? "is-undo" : ""}" data-mvp="${p.tag}" data-action="${mine && mvpState.open && !out ? "unvote" : "vote"}" ${locked || out ? "disabled" : ""}>${label}</button>
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
  mvpState.degraded = Boolean(data.degraded);
  mvpState.remainingMs = Number(data.remainingMs) || 0;
  mvpState.endsAt = data.endsAt || null;
  mvpState.out = Array.isArray(data.out) ? data.out : [];
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
  paintMvpClock();
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
  paintAdmPlacar();
};

if (mvpAdminPin) showMvpAdminOps();

const setMvpAdminError = (message) => {
  const hint = document.getElementById("mvp-admin-hint");
  if (!hint) return;
  hint.textContent = message;
  hint.classList.toggle("is-error", Boolean(message));
};

const postMvpAdmin = async (action, extra = {}) => {
  let res;
  let data;
  try {
    res = await fetch("/api/mvp", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poll: mvpPoll.id, action, pin: mvpAdminPin, ...extra }),
    });
    data = await res.json().catch(() => ({}));
  } catch {
    setMvpAdminError("Sem conexão com o servidor da urna. Tenta de novo.");
    throw new Error("network");
  }
  if (res.status === 403) {
    setMvpAdminError("Código admin errado.");
    throw new Error("pin");
  }
  if (res.status === 503) {
    setMvpAdminError("O banco de votos não respondeu. Nada foi alterado, tenta de novo.");
    throw new Error("storage");
  }
  if (action !== "auth" && (res.ok || res.status === 409)) applyMvpData(data);
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

const toggleMvpPlayed = (tag) => {
  if (!tag || !mvpAdminPin) return;
  postMvpAdmin("out", { player: tag, on: !mvpIsOut(tag) }).catch(() => {});
};

document.getElementById("mvp-out")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-out]");
  if (!btn) return;
  toggleMvpPlayed(btn.getAttribute("data-out"));
});

document.getElementById("mvp-played-all")?.addEventListener("click", () => {
  postMvpAdmin("out", { all: true, on: false }).catch(() => {});
});

document.getElementById("mvp-played-none")?.addEventListener("click", () => {
  postMvpAdmin("out", { all: true, on: true }).catch(() => {});
});

const postPlacarAdmin = async (action, extra = {}) => {
  let res;
  let data;
  try {
    res = await fetch("/api/placar", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, pin: mvpAdminPin, us: placarState.us, them: placarState.them, ...extra }),
    });
    data = await res.json().catch(() => ({}));
  } catch {
    const hint = document.getElementById("adm-placar-hint");
    if (hint) {
      hint.classList.add("is-error");
      hint.textContent = "Sem conexão com o placar. Tenta de novo.";
    }
    throw new Error("network");
  }
  if (res.status === 403) {
    setMvpAdminError("Código admin errado.");
    throw new Error("pin");
  }
  if (res.status === 503) {
    const hint = document.getElementById("adm-placar-hint");
    if (hint) {
      hint.classList.add("is-error");
      hint.textContent = "O banco não respondeu. O placar não mudou.";
    }
    throw new Error("storage");
  }
  if (res.ok) {
    applyPlacarData(data);
    if (!placarState.live && !placarState.done) pullCopaLive();
    else paintCompetition();
    paintAdmPlacar();
  }
  return res;
};

document.getElementById("adm-placar")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-placar]");
  if (!btn || !mvpAdminPin) return;
  const key = btn.getAttribute("data-placar");
  const dir = Number(btn.getAttribute("data-dir")) || 0;
  const next = Math.max(0, Math.min(20, (Number(placarState[key]) || 0) + dir));
  postPlacarAdmin("set", { [key]: next }).catch(() => {});
});

document.getElementById("adm-placar-live")?.addEventListener("click", () => {
  postPlacarAdmin("live").catch(() => {});
});

document.getElementById("adm-placar-end")?.addEventListener("click", () => {
  postPlacarAdmin("end").catch(() => {});
});

document.getElementById("adm-placar-clear")?.addEventListener("click", () => {
  if (!window.confirm("Limpar o placar da home? O público volta a ver VS, sem número.")) return;
  postPlacarAdmin("clear").catch(() => {});
});

document.getElementById("mvp-grid")?.addEventListener("click", async (event) => {
  const playBtn = event.target.closest("button[data-out]");
  if (playBtn) {
    toggleMvpPlayed(playBtn.getAttribute("data-out"));
    return;
  }
  const btn = event.target.closest("button[data-mvp]");
  if (!btn || !mvpState.open) return;
  const tag = btn.getAttribute("data-mvp");
  if (mvpIsOut(tag)) return;
  const undo = btn.getAttribute("data-action") === "unvote";
  if (undo && !window.confirm(`Tirar seu voto em ${tag}? Depois dá pra votar de novo.`)) return;
  btn.disabled = true;
  try {
    const res = await fetch("/api/mvp", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: undo
        ? JSON.stringify({ poll: mvpPoll.id, action: "unvote" })
        : JSON.stringify({ poll: mvpPoll.id, player: tag }),
    });
    const data = await res.json();
    if (res.ok) applyMvpData(undo ? { ...data, voted: false, mine: null } : { ...data, voted: true, mine: data.mine || tag });
    else if (res.status === 403) applyMvpData(data);
    else throw new Error("vote");
  } catch {
    const status = document.getElementById("mvp-status");
    if (status) {
      status.textContent = undo
        ? "Não rolou tirar o voto. Tenta de novo."
        : "Não rolou registrar o voto. Tenta de novo.";
    }
    btn.disabled = false;
  }
  renderMvp();
});

refreshMvp();
mvpTimer = window.setInterval(tickMvp, 1000);

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
