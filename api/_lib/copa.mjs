import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataDir =
  process.env.DATA_DIR || (process.env.VERCEL ? "/tmp" : path.join(root, "data"));
const cacheFile = path.join(dataDir, "copa-cache.json");
const TEAM_SLUG = "tteuw-brkk";
const TEAM_NAME = "Bala de Munich";
const BASE = "https://copastreamers.com.br";
const REFRESH_MS = Number(process.env.COPA_REFRESH_MS) || 90_000;
// A contagem de amistosos começa daqui pra frente: o acervo antigo misturava
// série oficial com treino e não dava pra separar. Pra recomeçar de novo, é só
// mudar esta data (ou passar COPA_AMISTOSOS_DESDE).
const FRIENDLIES_SINCE = Date.parse(
  process.env.COPA_AMISTOSOS_DESDE || "2026-09-10T15:20:00.000Z"
);
const FETCH_MS = 12_000;
// A Copa já tem Bala x Equipe X na semifinal, mas ainda não publicou o horário.
// Enquanto `quando` vier vazio, o site usa hoje 14/09 às 18h (Brasília).
// Quando a API preencher a data, ela manda.
const SF_BALA_KICKOFF = process.env.COPA_SF_KICKOFF || "2026-09-14T21:00:00.000Z";
// Grande final hoje, 16/09, a partir das 18h em Brasília. Se a Copa publicar
// outro horário, ele manda. Enquanto vier vazio ou 00:00, o site usa este.
const FF_BALA_KICKOFF = process.env.COPA_FF_KICKOFF || "2026-09-16T21:00:00.000Z";
const FF_BALA_KICKOFF_LABEL = "hoje · 16/09 · a partir das 18h";
// A Copa ainda não fechou as semis (S1 2–1 ao vivo, S2 vazia) nem montou a
// final. O site usa o resultado real até o feed oficial atualizar.
const MANUAL_SF = [
  { home: "Bala de Munich", away: "Equipe X", hs: 3, as: 1 },
  { home: "Narizes FC", away: "Botafofo", hs: 2, as: 3 },
];
const MANUAL_FINAL = {
  home: "Bala de Munich",
  away: "Botafofo",
};

const ALIASES = {
  dg: "DG",
  dgziniwnl: "DG",
  davasco: "Davasco",
  davasco26: "Davasco",
  brkk: "Brkk",
  brkktheman: "Brkk",
  tteuw: "tteuw",
  ttteuw: "tteuw",
  nebacetin: "Nebacetin",
  onebacetin: "Nebacetin",
  bluue: "Bluue",
  ptbluue: "Bluue",
  pedrosemfreio: "pedrosemfreio",
  luccaf14: "luccaf14",
  lucca: "luccaf14",
  gordin: "Gordin",
  gordinn9j: "Gordin",
  gordiin9j: "Gordin",
  baraka: "Baraka",
  barakaf14: "Baraka",
  barascaeta: "Baraka",
  jmdeck: "Jmdeck",
  beliene: "Beliene",
  beliene157: "Beliene",
};

const GROUP_C_TEAMS = [
  "Equipe X",
  "Bala de Munich",
  "Low Profile FC",
  "RadiANTAS FC",
  "Kosky Korp",
];

const CREST = {
  "Bala de Munich": "assets/crest.png",
  "Raposo FC": "assets/clubs/raposo-fc.png",
  "Apeludos FC": "assets/clubs/apeludos-fc.png",
  "Equipe X": "assets/clubs/equipe-x.png",
  "Cobra Del Toro FC": "assets/clubs/cobra-del-toro-fc.png",
  "Narizes FC": "assets/clubs/narizes-fc.png",
  "Osempic do Marcelo": "assets/clubs/osempic-do-marcelo.png",
  "Botafofo": "assets/clubs/botafofo.png",
  "Low Profile FC": "assets/clubs/low-profile-fc.png",
  "RadiANTAS FC": "assets/clubs/radiantas-fc.png",
  "Kosky Korp": "assets/clubs/kosky-korp.png",
  "A definir": null,
};

const SLUG_NAME = {
  "tteuw-brkk": "Bala de Munich",
  fontinnele: "Raposo FC",
  nobru: "Apeludos FC",
  "bak-thurzin": "Equipe X",
  luqueta: "Cobra Del Toro FC",
  coringa: "Narizes FC",
  caiox: "Osempic do Marcelo",
  piuzinho: "Botafofo",
  kosky: "Kosky Korp",
  tck: "RadiANTAS FC",
  "renato-vicente": "Low Profile FC",
};

// Os amistosos usam nomes de clube diferentes dos da Copa (é o nome do clube no
// jogo, não o do time no torneio). Só mapeamos os que são o mesmo clube.
const FRIENDLY_NAME = {
  fcapeludos: "Apeludos FC",
  rapososnp: "Raposo FC",
};

const SLUG_OWNER = {
  "tteuw-brkk": "tteuw & Brkk",
  fontinnele: "Fontinnele",
  nobru: "Nobru",
  "bak-thurzin": "Bak & Thurzin",
  luqueta: "Luqueta",
  coringa: "Coringa",
  caiox: "Caiox",
  piuzinho: "Piuzinho",
  kosky: "–",
  tck: "–",
  "renato-vicente": "–",
};

let cache = null;
let inflight = null;

function decode(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function htmlLines(html) {
  return decode(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function fetchText(url, timeoutMs = FETCH_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "BalaDeMunichSite/1.0 (+local sync)",
        Accept: "text/html,application/json",
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url) {
  const raw = await fetchText(url);
  return JSON.parse(raw);
}

function norm(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function canonPlayer(name) {
  const key = norm(name);
  if (!key || /^\d+$/.test(key)) return null;
  return ALIASES[key] || name;
}

function isUs(name) {
  return norm(name) === norm(TEAM_NAME);
}

function clubMeta(name, owner = "–") {
  if (!name || name === "A definir" || name === "–") {
    return { owner: "–", tbd: true };
  }
  const crest = CREST[name] || null;
  return { owner, crest, us: isUs(name) };
}

function parseScore(token) {
  if (token === "–" || token === "-" || token === "—") return null;
  if (/^\d+$/.test(token)) return Number(token);
  return undefined;
}

function parseGroupC(lines) {
  const start = lines.findIndex((l, i) => l === "Grupo C" && lines[i + 1] !== "Grupo C");
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start + 3 && (l === "Grupo D" || l === "Estatísticas"));
  const block = lines.slice(start, end > start ? end : start + 140);
  const rows = [];
  for (const team of GROUP_C_TEAMS) {
    const idx = block.findIndex((l) => l === team);
    if (idx < 0) continue;
    let i = idx + 1;
    while (i < block.length && (block[i] === "Classificado" || block[i].startsWith("—") || block[i] === "em zona de classificação")) {
      i += 1;
    }
    if (block[i] === "+") {
      i += 1;
      if (/^\d+$/.test(block[i])) i += 1;
    }
    const stats = [];
    while (i < block.length && stats.length < 7) {
      if (/^[+-]?\d+$/.test(block[i])) stats.push(Number(block[i]));
      i += 1;
    }
    if (stats.length < 7) continue;
    const [j, pts, v, d, gp, gc, sg] = stats;
    let pos = rows.length + 1;
    for (let k = idx - 1; k >= Math.max(0, idx - 10); k--) {
      if (block[k] === "º" && /^\d+$/.test(block[k - 1])) {
        pos = Number(block[k - 1]);
        break;
      }
    }
    rows.push({ pos, team, j, pts, v, d, gp, gc, sg, us: isUs(team) });
  }
  rows.sort((a, b) => a.pos - b.pos);
  return rows.length ? rows : null;
}

function parseTeamStats(lines) {
  const idx = lines.findIndex((l, i) => l === "partidas" && /^\d+$/.test(lines[i - 1]));
  if (idx < 0) return null;
  const n = (label) => {
    const i = lines.indexOf(label, idx - 2);
    if (i > 0 && /^-?\d+%?$/.test(lines[i - 1])) return lines[i - 1];
    return null;
  };
  const matches = Number(lines[idx - 1]);
  const wins = Number(n("vitórias"));
  const draws = Number(n("empates"));
  const losses = Number(n("derrotas"));
  const goalsFor = Number(n("gols pró"));
  const goalsAgainst = Number(n("gols contra"));
  const clean = n("sem sofrer gol");
  const pass = n("passes certos");
  if (![matches, wins, draws, losses, goalsFor, goalsAgainst].every((v) => Number.isFinite(v))) return null;
  return {
    matches,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    cleanSheets: clean ? Number(clean) : undefined,
    passPct: pass || undefined,
    record: `${wins}-${draws}-${losses}`,
  };
}

function parseBalaList(lines, heading, unit) {
  const start = lines.findIndex((l) => l === heading);
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] === "Assistências" && heading === "Artilheiros") break;
    if (lines[i] === "MVP" && heading !== "MVP") break;
    if (lines[i] === TEAM_NAME) {
      const tag = canonPlayer(lines[i - 1]);
      if (!tag) continue;
      let value = 0;
      for (let k = i + 1; k < Math.min(lines.length, i + 8); k++) {
        if (lines[k] === unit && /^\d+$/.test(lines[k - 1])) {
          value = Number(lines[k - 1]);
          break;
        }
      }
      out.push({ tag, pos: "", goals: unit === "gols" ? value : 0, assists: unit === "assist." || unit === "assistências" ? value : 0, games: 0 });
    }
    if (out.length >= 8) break;
  }
  return out;
}

function parseLeaders(artilheirosJson, grupoLines) {
  const htmlScorers = parseBalaList(grupoLines, "Artilheiros", "gols");
  const htmlAssists = parseBalaList(grupoLines, "Assistências", "assist.");
  if (htmlAssists.length === 0) {
    htmlAssists.push(...parseBalaList(grupoLines, "Assistências", "assistências"));
  }
  if (htmlScorers.length) {
    return {
      scorers: htmlScorers,
      assists: htmlAssists.length ? htmlAssists : null,
    };
  }
  const fromTeam = (rows, key) =>
    (rows || [])
      .filter((row) => row.timeSlug === TEAM_SLUG || /munich/i.test(row.timeNome || ""))
      .map((row) => {
        const tag = canonPlayer(row.nome);
        if (!tag) return null;
        return {
          tag,
          pos: "",
          goals: Number(row.gols) || 0,
          assists: Number(row.assistencias) || 0,
          games: Number(row.jogos) || 0,
          value: Number(row[key]) || 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

  const scorers = fromTeam(artilheirosJson.artilheiros, "gols").map(({ value, ...rest }) => rest);
  const assists = fromTeam(artilheirosJson.assistencias, "assistencias").map(({ value, ...rest }) => rest);
  return {
    scorers: scorers.length ? scorers : null,
    assists: assists.length ? assists : null,
  };
}

function takeTie(lines, i, known) {
  const nameAt = (idx) => (known.has(lines[idx]) ? lines[idx] : null);
  const home = nameAt(i);
  if (!home) return null;
  let j = i + 1;
  let homeOwner = "–";
  if (j < lines.length && parseScore(lines[j]) === undefined && !nameAt(j) && lines[j] !== "Ver as partidas de") {
    homeOwner = lines[j];
    j += 1;
  }
  const hs = parseScore(lines[j]);
  if (hs === undefined) return null;
  j += 1;
  const away = nameAt(j);
  if (!away) return null;
  j += 1;
  let awayOwner = "–";
  if (j < lines.length && parseScore(lines[j]) === undefined && !nameAt(j) && !/^(Ver |ter\.|qua\.|seg\.|A agendar)/.test(lines[j])) {
    awayOwner = lines[j];
    j += 1;
  }
  const as = parseScore(lines[j]);
  if (as === undefined) return null;
  j += 1;
  let date = "A agendar";
  const limit = Math.min(lines.length, j + 10);
  while (j < limit) {
    const line = lines[j];
    if (line === "Semifinal" || line === "Grande final" || line === "Quartas de final" || line === "Estatísticas") break;
    if (line === "A agendar" || /\d{2}\/\d{2}/.test(line) || /^(seg|ter|qua|qui|sex|sáb|sab|dom)\./i.test(line)) {
      date = line;
      j += 1;
      break;
    }
    j += 1;
  }
  if (lines[j] === "Ver detalhes →") j += 1;
  return {
    home,
    away,
    hs,
    as,
    date,
    homeOwner,
    awayOwner,
    next: j,
  };
}

function parseBracket(lines) {
  const start = lines.indexOf("Quartas de final");
  if (start < 0) return null;
  const known = new Set([
    TEAM_NAME,
    "Raposo FC",
    "Apeludos FC",
    "Equipe X",
    "Cobra Del Toro FC",
    "Narizes FC",
    "Osempic do Marcelo",
    "Botafofo",
    "A definir",
  ]);
  for (let i = start; i < Math.min(lines.length, start + 80); i++) {
    if (
      /FC$/.test(lines[i]) ||
      lines[i] === "Botafofo" ||
      lines[i] === TEAM_NAME ||
      lines[i] === "Equipe X" ||
      lines[i] === "A definir"
    ) {
      known.add(lines[i]);
    }
  }

  const grab = (count, from) => {
    const ties = [];
    let i = from;
    while (i < lines.length && ties.length < count) {
      if (lines[i] === "Semifinal" || lines[i] === "Grande final" || lines[i] === "Estatísticas") break;
      const tie = takeTie(lines, i, known);
      if (tie) {
        ties.push(tie);
        i = tie.next;
      } else i += 1;
    }
    return ties;
  };

  const qfStart = start + 1;
  const qf = grab(4, qfStart);
  const sfIdx = lines.indexOf("Semifinal", start);
  const ffIdx = lines.indexOf("Grande final", start);
  const sf = sfIdx >= 0 ? grab(2, sfIdx + 1) : [];
  const ff = ffIdx >= 0 ? grab(1, ffIdx + 1) : [];
  if (qf.length < 2) return null;

  const toCard = (tie, id, extra = {}) => ({
    id,
    home: tie.home,
    away: tie.away,
    hs: tie.hs,
    as: tie.as,
    date: tie.date,
    us: isUs(tie.home) || isUs(tie.away),
    ...extra,
  });

  const clubs = {};
  for (const tie of [...qf, ...sf, ...ff]) {
    clubs[tie.home] = clubMeta(tie.home, tie.homeOwner);
    clubs[tie.away] = clubMeta(tie.away, tie.awayOwner);
  }

  return {
    clubs,
    bracket: [
      {
        round: "Quartas de final",
        n: "01",
        key: "qf",
        ties: qf.map((t, i) => toCard(t, `qf-${i}`)),
      },
      {
        round: "Semifinal",
        n: "02",
        key: "sf",
        ties: (sf.length ? sf : [{ home: "A definir", away: "A definir", hs: null, as: null, date: "A agendar", homeOwner: "–", awayOwner: "–" }]).map(
          (t, i) => toCard(t, `sf-${i}`)
        ),
      },
      {
        round: "Grande final",
        n: "03",
        key: "ff",
        ties: (ff.length ? ff : [{ home: "A definir", away: "A definir", hs: null, as: null, date: FF_BALA_KICKOFF_LABEL, homeOwner: "–", awayOwner: "–" }]).map(
          (t, i) => toCard(t, `ff-${i}`, { final: true })
        ),
      },
    ],
  };
}

function balaSeries(bracket) {
  const ties = bracket.flatMap((r) => r.ties.map((t) => ({ ...t, round: r.round })));
  const ours = ties.filter((t) => t.us);
  const played = ours.filter((t) => !t.live && t.hs !== null && t.as !== null);
  const open = ours.find((t) => t.live || t.hs === null || t.as === null);
  const last = played.at(-1) || played[0];
  const usHome = last && isUs(last.home);
  const results = played
    .slice()
    .reverse()
    .map((t) => {
      const us = isUs(t.home) ? t.hs : t.as;
      const them = isUs(t.home) ? t.as : t.hs;
      const opp = isUs(t.home) ? t.away : t.home;
      const result = us > them ? "W" : us < them ? "L" : "D";
      return {
        date: t.round.replace(" de final", ""),
        opponent: opp,
        score: `${us}–${them}`,
        result,
        note: t.date,
      };
    });
  const lastMatch = last
    ? {
        opponent: isUs(last.home) ? last.away : last.home,
        score: `${usHome ? last.hs : last.as}–${usHome ? last.as : last.hs}`,
        result: (usHome ? last.hs - last.as : last.as - last.hs) > 0 ? "W" : (usHome ? last.hs - last.as : last.as - last.hs) < 0 ? "L" : "D",
        note: `${last.round.replace(" de final", "")} · ${last.date}`,
      }
    : null;
  const nextMatch = open
    ? {
        opponent: isUs(open.home) ? open.away : open.home,
        competition: `${open.round} · MD5`,
        date: open.date,
        venue: "Mata-mata",
      }
    : {
        opponent: "A definir",
        competition: "Mata-mata · MD5",
        date: "A agendar",
        venue: "Mata-mata",
      };
  let motto = "Na copa. Bala de Munich.";
  if (open?.live) {
    const us = isUs(open.home) ? open.hs : open.as;
    const them = isUs(open.home) ? open.as : open.hs;
    const rival = isUs(open.home) ? open.away : open.home;
    motto = `${open.round} ao vivo. Bala ${us}–${them} ${rival}.`;
  } else if (open) {
    const rival = isUs(open.home) ? open.away : open.home;
    const tbd = rival === "A definir";
    if ((isUs(open.home) || isUs(open.away)) && tbd && /final/i.test(open.round)) {
      motto = "Estamos na final.";
    } else if (tbd) {
      motto = `Na ${open.round.toLowerCase()}. Adversário a definir.`;
    } else if (/final/i.test(open.round) && (isUs(open.home) || isUs(open.away))) {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      motto = today === "2026-09-16" ? `Hoje é final contra o ${rival}.` : `${open.round} contra ${rival}.`;
    } else {
      motto = `${open.round} contra ${rival}.`;
    }
  } else if (last) {
    motto = `Última série ${lastMatch.score} vs ${lastMatch.opponent}.`;
  }
  return { lastMatch, nextMatch, results, motto };
}

function withGroupPos(stats, table) {
  if (!stats) return null;
  const us = table?.find((row) => row.us);
  const classified = us && us.pos <= 2;
  return {
    ...stats,
    groupPos: us ? `${us.pos}º` : stats.groupPos,
    group: "Grupo C",
    points: us ? us.pts : stats.points,
    series: us ? us.j : stats.series,
    seriesWins: us ? us.v : stats.seriesWins,
    seriesLosses: us ? us.d : stats.seriesLosses,
    classified,
  };
}

function nameOf(slug) {
  if (!slug) return "A definir";
  return SLUG_NAME[slug] || slug;
}

function formatQuando(iso) {
  if (!iso) return "A agendar";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "A agendar";
  const txt = d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return txt.replace(/\./g, "").replace(/,/g, " ·").replace(/\s+/g, " ").trim();
}

function computeGroupC(partidas) {
  const rows = {};
  for (const team of GROUP_C_TEAMS) {
    rows[team] = { team, j: 0, pts: 0, v: 0, d: 0, gp: 0, gc: 0, sg: 0, us: isUs(team) };
  }
  for (const match of partidas || []) {
    if (match.grupo !== "C" || match.status !== "final") continue;
    const home = nameOf(match.time_a);
    const away = nameOf(match.time_b);
    if (!rows[home] || !rows[away]) continue;
    const hs = Number(match.gols_a);
    const as = Number(match.gols_b);
    const hgf = Number(match.gols_reais_a) || 0;
    const agf = Number(match.gols_reais_b) || 0;
    rows[home].j += 1;
    rows[away].j += 1;
    rows[home].gp += hgf;
    rows[home].gc += agf;
    rows[away].gp += agf;
    rows[away].gc += hgf;
    if (hs > as) {
      rows[home].v += 1;
      rows[home].pts += 3;
      rows[away].d += 1;
    } else if (as > hs) {
      rows[away].v += 1;
      rows[away].pts += 3;
      rows[home].d += 1;
    }
  }
  const table = Object.values(rows).map((row) => ({ ...row, sg: row.gp - row.gc }));
  table.sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.gp - a.gp);
  table.forEach((row, i) => {
    row.pos = i + 1;
  });
  if (!table.some((row) => row.j > 0)) return null;
  return table;
}

function fillKnownKickoff(tie) {
  if (!tie || tie.quando || tie.status === "final") return tie;
  if (tie.fase === "final") return { ...tie, quando: FF_BALA_KICKOFF };
  if (tie.fase !== "semifinal") return tie;
  const home = nameOf(tie.lado_a);
  const away = nameOf(tie.lado_b);
  const ours = isUs(home) || isUs(away);
  const vsX = home === "Equipe X" || away === "Equipe X";
  if (!ours || !vsX) return tie;
  return { ...tie, quando: SF_BALA_KICKOFF };
}

function stampFinalKickoff(tie) {
  if (!tie) return;
  const done = !tie.live && tie.hs != null && tie.as != null;
  if (done) return;
  const date = String(tie.date || "");
  if (!date || date === "A agendar" || /horário a definir|00:00$/.test(date) || (/16\/09/.test(date) && /18:00$/.test(date))) {
    tie.date = FF_BALA_KICKOFF_LABEL;
    let hour = "";
    if (tie.iso) {
      const d = new Date(tie.iso);
      if (!Number.isNaN(d.getTime())) {
        hour = d.toLocaleString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false });
      }
    }
    if (!tie.iso || hour === "00" || hour === "18") tie.iso = FF_BALA_KICKOFF;
  }
}

function applyManualResult(parsed) {
  if (!parsed?.bracket) return parsed;
  for (const round of parsed.bracket) {
    for (const tie of round.ties || []) {
      const manual = MANUAL_SF.find((m) => round.key === "sf" && tie.home === m.home && tie.away === m.away);
      if (manual && !(tie.hs != null && tie.as != null && !tie.live)) {
        tie.hs = manual.hs;
        tie.as = manual.as;
        tie.live = false;
        if (!tie.date || String(tie.date).startsWith("Ao vivo") || tie.date === "A agendar") {
          tie.date = tie.iso ? formatQuando(tie.iso) : "Encerrada";
        }
      }
      if (round.key === "ff") {
        const copaNamed =
          tie.home &&
          tie.home !== "A definir" &&
          tie.away &&
          tie.away !== "A definir";
        if (!copaNamed) {
          tie.home = MANUAL_FINAL.home;
          tie.away = MANUAL_FINAL.away;
          tie.us = isUs(tie.home) || isUs(tie.away);
        }
        stampFinalKickoff(tie);
      }
    }
  }
  return parsed;
}

function bracketFromConfrontos(confrontos) {
  const list = [...(confrontos || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const qf = list.filter((c) => c.fase === "quartas");
  const sf = list.filter((c) => c.fase === "semifinal").map(fillKnownKickoff);
  const ff = list.filter((c) => c.fase === "final").map(fillKnownKickoff);
  if (qf.length < 2) return null;

  const toCard = (tie, id, extra = {}) => {
    const home = nameOf(tie.lado_a);
    const away = nameOf(tie.lado_b);
    const played = tie.status === "final" && tie.placar_a != null && tie.placar_b != null;
    return {
      id,
      home,
      away,
      hs: played ? Number(tie.placar_a) : null,
      as: played ? Number(tie.placar_b) : null,
      date: formatQuando(tie.quando),
      // Horário cru, além do formatado: é com ele que o site descobre que a
      // série já começou e ainda não tem placar, ou seja, está rolando agora.
      iso: tie.quando || null,
      us: isUs(home) || isUs(away),
      ...extra,
    };
  };

  const clubs = {};
  for (const tie of list) {
    const home = nameOf(tie.lado_a);
    const away = nameOf(tie.lado_b);
    clubs[home] = clubMeta(home, SLUG_OWNER[tie.lado_a] || "–");
    clubs[away] = clubMeta(away, SLUG_OWNER[tie.lado_b] || "–");
  }

  const placeholder = { lado_a: null, lado_b: null, placar_a: null, placar_b: null, status: "pendente", quando: null };
  return {
    clubs,
    bracket: [
      {
        round: "Quartas de final",
        n: "01",
        key: "qf",
        ties: qf.map((t, i) => toCard(t, `qf-${i}`)),
      },
      {
        round: "Semifinal",
        n: "02",
        key: "sf",
        ties: (sf.length ? sf : [placeholder, placeholder]).map((t, i) => toCard(t, `sf-${i}`)),
      },
      {
        round: "Grande final",
        n: "03",
        key: "ff",
        ties: (ff.length ? ff : [{ ...placeholder, quando: FF_BALA_KICKOFF }]).map((t, i) =>
          toCard(t, `ff-${i}`, { final: true })
        ),
      },
    ],
  };
}

function canonClub(name) {
  const key = norm(name);
  if (!key) return null;
  if (FRIENDLY_NAME[key]) return FRIENDLY_NAME[key];
  return Object.keys(CREST).find((known) => norm(known) === key) || String(name);
}

// A Copa não publica API de amistosos: a página /partidas manda os jogos dentro
// do payload do Next, e é de lá que tiramos os dados.
function flightPayload(html) {
  let out = "";
  for (const chunk of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try {
      out += JSON.parse(chunk[1]);
    } catch {
      /* pedaço quebrado: ignora */
    }
  }
  return out;
}

function sliceJson(src, at) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = at; i < src.length; i += 1) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[" || c === "{") depth += 1;
    else if (c === "]" || c === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(at, i + 1);
    }
  }
  return null;
}

function friendlyList(flight) {
  for (const hit of flight.matchAll(/"partidas":\[/g)) {
    const raw = sliceJson(flight, flight.indexOf("[", hit.index));
    if (!raw) continue;
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.some((m) => m?.tipo === "amistoso")) return arr;
    } catch {
      /* não era esse array */
    }
  }
  return null;
}

// Data literal de Brasília, sem remendo de madrugada: jogo que terminou 00:21
// de quarta é quarta mesmo. Misturar o dia da véspera com a hora da madrugada
// produzia card que se contradizia sozinho.
function friendlyDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value.replace(".", "") || "";
  return `${get("weekday")} ${get("day")}/${get("month")} · ${get("hour")}:${get("minute")}`;
}

function friendlyCrest(name, avatar) {
  if (CREST[name]) return CREST[name];
  return avatar ? `${BASE}${avatar}` : null;
}

function toFriendly(match) {
  // Jogo que os times quitaram no meio fica sempre 0–0 e não diz nada sobre o
  // time, então nem entra na lista.
  if (match?.abandonada) return null;
  if (!(Date.parse(match?.data) >= FRIENDLIES_SINCE)) return null;
  if (!Array.isArray(match?.lados) || match.lados.length !== 2) return null;
  const sides = match.lados.map((side) => ({ ...side, club: canonClub(side.time || side.clube) }));
  const ours = sides.find((side) => isUs(side.club));
  const theirs = sides.find((side) => side !== ours);
  if (!ours || !theirs) return null;

  const us = Number(ours.gols) || 0;
  const them = Number(theirs.gols) || 0;
  // Jogador anônimo vem com nome "-" na base da EA: sem nome, não vira crédito.
  const scorers = (ours.escalacao || [])
    .filter((p) => Number(p.gols) > 0 && norm(p.nome))
    .map((p) => ({ name: canonPlayer(p.nome) || p.nome, goals: Number(p.gols) }))
    .sort((a, b) => b.goals - a.goals);

  return {
    id: String(match.id),
    // Marca o que veio da Copa agora: o histórico do data.js não tem essa flag,
    // e é ela que decide o que entra na faixa do topo.
    live: true,
    iso: match.data,
    date: friendlyDate(match.data),
    opponent: theirs.club,
    opponentOwner: theirs.presidente || "–",
    crest: friendlyCrest(theirs.club, theirs.avatar),
    us,
    them,
    score: `${us}–${them}`,
    result: us > them ? "W" : us < them ? "L" : "D",
    format: `${Number(ours.jogadores) || 11}v${Number(theirs.jogadores) || 11}`,
    star: ours.craque ? canonPlayer(ours.craque) || ours.craque : null,
    scorers,
  };
}

async function fetchFriendlies() {
  // Página inteira do Next (~500 KB) e a função tem 10s de teto na Vercel: se
  // demorar, é melhor devolver a Copa sem amistoso do que estourar o limite.
  const html = await fetchText(`${BASE}/partidas`, 6_000);
  const list = friendlyList(flightPayload(html));
  if (!list) throw new Error("amistosos sem payload");
  // Lista vazia é resposta legítima (ainda não teve amistoso novo), então não
  // vira erro: só falha de verdade sobe, pra não apagar o acervo em cache.
  return list
    .map(toFriendly)
    .filter(Boolean)
    .sort((a, b) => String(b.iso).localeCompare(String(a.iso)));
}

function usefulLive(payload) {
  const played = payload?.groupTable?.some((row) => Number(row.j) > 0);
  const scored = payload?.bracket?.some((round) => round.ties?.some((t) => t.hs != null));
  return Boolean(played || scored);
}

async function buildLive() {
  // Amistoso quebrado não pode derrubar a Copa: por isso o catch separado.
  const [e2, friendlies] = await Promise.all([
    fetchJson(`${BASE}/api/e2-dados`),
    fetchFriendlies().catch((err) => {
      console.error("amistosos sync", err.message);
      return null;
    }),
  ]);
  const groupTable = computeGroupC(e2.partidas);
  const parsedBracket = bracketFromConfrontos(e2.confrontos);
  if (parsedBracket) applyManualResult(parsedBracket);
  const series = parsedBracket ? balaSeries(parsedBracket.bracket) : {};
  const us = groupTable?.find((row) => row.us);
  const stats = withGroupPos(
    {
      goalsFor: us?.gp,
      goalsAgainst: us?.gc,
    },
    groupTable
  );
  const payload = {
    ok: true,
    atualizadoEm: new Date().toISOString(),
    source: BASE,
    motto: series.motto || null,
    stats,
    lastMatch: series.lastMatch || null,
    nextMatch: series.nextMatch || null,
    groupTable,
    scorers: null,
    assists: null,
    results: series.results || null,
    bracket: parsedBracket?.bracket || null,
    clubs: parsedBracket?.clubs || null,
    friendlies,
  };
  if (!usefulLive(payload)) throw new Error("copa json vazio");
  return payload;
}

function readDisk() {
  try {
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  } catch {
    return null;
  }
}

function writeDisk(payload) {
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(payload));
  } catch (err) {
    console.error("copa cache", err.message);
  }
}

export async function getCopaLive(force = false) {
  const now = Date.now();
  if (!force && cache?.payload && now - cache.at < REFRESH_MS) return cache.payload;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const payload = await buildLive();
      if (!usefulLive(payload) && usefulLive(cache?.payload || readDisk())) {
        throw new Error("copa json vazio");
      }
      // Só falha de leitura recupera o cache. Lista vazia é estado real e tem
      // que sobrescrever, senão amistoso apagado volta do túmulo.
      if (!payload.friendlies) {
        const kept = (cache?.payload || readDisk())?.friendlies;
        if (kept?.length) payload.friendlies = kept;
      }
      cache = { payload, at: Date.now() };
      writeDisk(payload);
      return payload;
    } catch (err) {
      console.error("copa sync", err.message);
      const fallback = cache?.payload || readDisk();
      if (fallback) {
        cache = { payload: fallback, at: Date.now() - REFRESH_MS / 2 };
        return { ...fallback, stale: true, erro: err.message };
      }
      return { ok: false, erro: err.message };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function startCopaSync() {
  cache = { payload: readDisk(), at: 0 };
  getCopaLive(true).then((data) => {
    if (data?.ok) console.log("copa sync ok", data.atualizadoEm);
    else console.warn("copa sync falhou", data?.erro);
  });
  setInterval(() => {
    getCopaLive(true).catch(() => {});
  }, REFRESH_MS);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const live = await buildLive();
  console.log(JSON.stringify(live, null, 2));
}
