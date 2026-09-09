import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { getCopaLive, startCopaSync } from "./copa.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DATA_DIR || path.join(root, "data");
const votesFile = path.join(dataDir, "votes.json");
const allow = [
  "tteuw",
  "Brkk",
  "DG",
  "Davasco",
  "Nebacetin",
  "Bluue",
  "Pedro Sem Freio",
  "luccaf14",
  "Gordin",
  "Baraka",
  "Vini Show",
  "Jmdeck",
  "Beliene",
  "2Tclipes",
];
const pollId = "quartas-raposo";
const durationHours = 2;
const startPin = process.env.MVP_ADMIN_PIN || "tteuw";
const preferredPort = Number(process.env.PORT) || 8765;
const host = process.env.HOST || "0.0.0.0";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function emptyStore() {
  return { polls: {} };
}

function emptyPoll() {
  return { ballots: {}, startedAt: null, endsAt: null, paused: false, remainingMs: 0 };
}

function readVotes() {
  try {
    const raw = fs.readFileSync(votesFile, "utf8");
    if (!raw.trim()) return emptyStore();
    const obj = JSON.parse(raw);
    if (!obj.polls || typeof obj.polls !== "object") return emptyStore();
    return obj;
  } catch {
    return emptyStore();
  }
}

function saveVotes(store) {
  fs.mkdirSync(path.dirname(votesFile), { recursive: true });
  fs.writeFileSync(votesFile, JSON.stringify(store), "utf8");
}

function totalsFrom(ballots) {
  const totals = {};
  for (const vote of Object.values(ballots || {})) {
    totals[vote] = (totals[vote] || 0) + 1;
  }
  return totals;
}

function parseIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getWindow(poll) {
  let startedAt = parseIso(poll.startedAt);
  let endsAt = parseIso(poll.endsAt);
  const paused = Boolean(poll.paused);
  const now = new Date();
  if (startedAt && !endsAt) {
    endsAt = new Date(startedAt.getTime() + durationHours * 3600 * 1000);
  }
  let remainingMs = 0;
  let open = false;
  if (startedAt) {
    if (paused) {
      remainingMs = Math.max(0, Number(poll.remainingMs) || 0);
    } else if (endsAt && now < endsAt) {
      open = true;
      remainingMs = Math.max(0, endsAt.getTime() - now.getTime());
    }
  }
  return {
    started: Boolean(startedAt),
    open,
    paused,
    startedAt: startedAt ? startedAt.toISOString() : null,
    endsAt: endsAt ? endsAt.toISOString() : null,
    remainingMs,
    durationHours,
  };
}

function mvpPayload(poll, voter) {
  const mine = poll.ballots?.[voter] || null;
  const totals = totalsFrom(poll.ballots);
  const total = Object.values(totals).reduce((a, n) => a + n, 0);
  const win = getWindow(poll);
  return {
    poll: pollId,
    open: win.open,
    paused: win.paused,
    started: win.started,
    startedAt: win.startedAt,
    endsAt: win.endsAt,
    remainingMs: win.remainingMs,
    durationHours: win.durationHours,
    total,
    totals,
    voted: Boolean(mine),
    mine,
  };
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

function sendJson(res, obj, status = 200, extraHeaders = {}) {
  const json = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(json);
}

function voterCookie(id) {
  return `mvp_vid=${id}; Path=/; HttpOnly; Max-Age=31536000; SameSite=Lax`;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function ensurePoll(store) {
  if (!store.polls) store.polls = {};
  if (!store.polls[pollId]) store.polls[pollId] = emptyPoll();
  const poll = store.polls[pollId];
  if (!poll.ballots) poll.ballots = {};
  if (!("startedAt" in poll)) poll.startedAt = null;
  if (!("endsAt" in poll)) poll.endsAt = null;
  if (!("paused" in poll)) poll.paused = false;
  if (!("remainingMs" in poll)) poll.remainingMs = 0;
  return poll;
}

async function handleMvp(req, res) {
  let voter = readCookie(req, "mvp_vid");
  const headers = {};
  if (!voter) {
    voter = crypto.randomBytes(16).toString("hex");
    headers["Set-Cookie"] = voterCookie(voter);
  }

  const store = readVotes();
  const poll = ensurePoll(store);

  if (req.method === "GET") {
    sendJson(res, mvpPayload(poll, voter), 200, headers);
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, { error: "method" }, 405, headers);
    return;
  }

  let body;
  try {
    body = JSON.parse((await readBody(req)) || "{}");
  } catch {
    sendJson(res, { error: "json" }, 400, headers);
    return;
  }

  const action = String(body.action || "");
  const adminActions = ["auth", "start", "pause", "resume", "close", "reset"];
  if (adminActions.includes(action)) {
    if (String(body.pin || "") !== startPin) {
      sendJson(res, { error: "pin" }, 403, headers);
      return;
    }
    if (action === "auth") {
      sendJson(res, { ok: true }, 200, headers);
      return;
    }
    const win = getWindow(poll);
    const now = new Date();
    if (action === "start") {
      if (win.started) {
        sendJson(res, mvpPayload(poll, voter), 409, headers);
        return;
      }
      poll.startedAt = now.toISOString();
      poll.endsAt = new Date(now.getTime() + durationHours * 3600 * 1000).toISOString();
      poll.paused = false;
      poll.remainingMs = durationHours * 3600 * 1000;
    } else if (action === "pause") {
      if (!win.open) {
        sendJson(res, mvpPayload(poll, voter), 409, headers);
        return;
      }
      poll.paused = true;
      poll.remainingMs = win.remainingMs;
    } else if (action === "resume") {
      if (!win.started || !win.paused || win.remainingMs <= 0) {
        sendJson(res, mvpPayload(poll, voter), 409, headers);
        return;
      }
      poll.paused = false;
      poll.endsAt = new Date(now.getTime() + poll.remainingMs).toISOString();
    } else if (action === "close") {
      if (!win.started || (!win.open && !win.paused)) {
        sendJson(res, mvpPayload(poll, voter), 409, headers);
        return;
      }
      poll.paused = false;
      poll.remainingMs = 0;
      poll.endsAt = now.toISOString();
    } else if (action === "reset") {
      store.polls[pollId] = emptyPoll();
      saveVotes(store);
      sendJson(res, mvpPayload(store.polls[pollId], voter), 200, headers);
      return;
    }
    store.polls[pollId] = poll;
    saveVotes(store);
    sendJson(res, mvpPayload(poll, voter), 200, headers);
    return;
  }

  const player = String(body.player || "");
  const reqPoll = String(body.poll || "");
  if (reqPoll !== pollId || !allow.includes(player)) {
    sendJson(res, { error: "invalid" }, 400, headers);
    return;
  }
  const win = getWindow(poll);
  if (!win.started || !win.open) {
    sendJson(res, mvpPayload(poll, voter), 403, headers);
    return;
  }
  const payload = mvpPayload(poll, voter);
  if (payload.voted) {
    sendJson(res, payload, 409, headers);
    return;
  }
  poll.ballots[voter] = player;
  store.polls[pollId] = poll;
  saveVotes(store);
  sendJson(res, mvpPayload(poll, voter), 200, headers);
}

function safeFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root + path.sep) && file !== root) return null;
  return file;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/healthz") {
      sendJson(res, { ok: true });
      return;
    }
    if (url.pathname === "/api/mvp") {
      await handleMvp(req, res);
      return;
    }
    if (url.pathname === "/api/copa") {
      sendJson(res, await getCopaLive());
      return;
    }
    const file = safeFile(url.pathname);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const headers = { "Content-Type": mime[ext] || "application/octet-stream" };
    if ([".css", ".js", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"].includes(ext)) {
      headers["Cache-Control"] = "public, max-age=3600";
    }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

function listen(port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off("listening", onListen);
      reject(err);
    };
    const onListen = () => {
      server.off("error", onError);
      resolve(port);
    };
    server.once("error", onError);
    server.once("listening", onListen);
    server.listen(port, host);
  });
}

const ports = Number(process.env.PORT)
  ? [preferredPort]
  : [preferredPort, 8766, 8767, 8768, 8769];

let bound = null;
for (const port of ports) {
  try {
    bound = await listen(port);
    break;
  } catch (err) {
    if (err.code !== "EADDRINUSE") throw err;
  }
}
if (!bound) {
  console.error("Nenhuma porta livre (8765-8769).");
  process.exit(1);
}
console.log(`listening ${bound}`);
console.log(`Bala de Munich em http://127.0.0.1:${bound}`);
startCopaSync();
