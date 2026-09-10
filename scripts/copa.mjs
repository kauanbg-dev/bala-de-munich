import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir =
  process.env.DATA_DIR || (process.env.VERCEL ? "/tmp" : path.join(root, "data"));
const cacheFile = path.join(dataDir, "copa-cache.json");
const TEAM_SLUG = "tteuw-brkk";
const TEAM_NAME = "Bala de Munich";
const BASE = "https://copastreamers.com.br";
const REFRESH_MS = Number(process.env.COPA_REFRESH_MS) || 90_000;
const FETCH_MS = 12_000;

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

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_MS);
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
        ties: (ff.length ? ff : [{ home: "A definir", away: "A definir", hs: null, as: null, date: "qua., 16/09 · horário a definir", homeOwner: "–", awayOwner: "–" }]).map(
          (t, i) => toCard(t, `ff-${i}`, { final: true })
        ),
      },
    ],
  };
}

function balaSeries(bracket) {
  const ties = bracket.flatMap((r) => r.ties.map((t) => ({ ...t, round: r.round })));
  const ours = ties.filter((t) => t.us);
  const played = ours.filter((t) => t.hs !== null && t.as !== null);
  const open = ours.find((t) => t.hs === null || t.as === null);
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
  if (open) {
    motto =
      open.away === "A definir" || open.home === "A definir"
        ? `Na ${open.round.toLowerCase()}. Adversário a definir.`
        : `${open.round} contra ${isUs(open.home) ? open.away : open.home}.`;
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

function bracketFromConfrontos(confrontos) {
  const list = [...(confrontos || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const qf = list.filter((c) => c.fase === "quartas");
  const sf = list.filter((c) => c.fase === "semifinal");
  const ff = list.filter((c) => c.fase === "final");
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
        ties: (ff.length ? ff : [{ ...placeholder, quando: "2026-09-16T03:00:00+00:00" }]).map((t, i) =>
          toCard(t, `ff-${i}`, { final: true })
        ),
      },
    ],
  };
}

function usefulLive(payload) {
  const played = payload?.groupTable?.some((row) => Number(row.j) > 0);
  const scored = payload?.bracket?.some((round) => round.ties?.some((t) => t.hs != null));
  return Boolean(played || scored);
}

async function buildLive() {
  const e2 = await fetchJson(`${BASE}/api/e2-dados`);
  const groupTable = computeGroupC(e2.partidas);
  const parsedBracket = bracketFromConfrontos(e2.confrontos);
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
