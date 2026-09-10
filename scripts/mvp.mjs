import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DATA_DIR || (process.env.VERCEL ? "/tmp" : path.join(root, "data"));
const votesFile = path.join(dataDir, "votes.json");
const kvKey = "mvp-votes";

export const allow = [
  "tteuw",
  "Brkk",
  "DG",
  "Davasco",
  "Nebacetin",
  "Bluue",
  "pedrosemfreio",
  "Pedro Sem Freio",
  "luccaf14",
  "Gordin",
  "Baraka",
  "wVini7",
  "Vini Show",
  "Jmdeck",
  "Beliene",
  "2Tclipes",
];
export const pollId = process.env.MVP_POLL_ID || "semifinal-e2";
export const durationHours = 2;
const startPin = process.env.MVP_ADMIN_PIN || "tteuw";

function emptyStore() {
  return { polls: {} };
}

function emptyPoll() {
  return { ballots: {}, startedAt: null, endsAt: null, paused: false, remainingMs: 0 };
}

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

function kvEnabled() {
  return Boolean(kvConfig());
}

async function kvCommand(parts) {
  const kv = kvConfig();
  const res = await fetch(kv.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kv.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parts),
  });
  if (!res.ok) throw new Error(`kv ${res.status}`);
  return res.json();
}

async function readVotes() {
  if (kvEnabled()) {
    try {
      const data = await kvCommand(["GET", kvKey]);
      const raw = data?.result;
      if (!raw) return emptyStore();
      const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!obj.polls || typeof obj.polls !== "object") return emptyStore();
      return obj;
    } catch (err) {
      console.error("mvp kv get", err.message);
      return emptyStore();
    }
  }
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

async function saveVotes(store) {
  if (kvEnabled()) {
    await kvCommand(["SET", kvKey, JSON.stringify(store)]);
    return;
  }
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

function voterCookie(id) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `mvp_vid=${id}; Path=/; HttpOnly; Max-Age=31536000; SameSite=Lax${secure}`;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
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

function result(json, status = 200, headers = {}) {
  return { json, status, headers };
}

export async function handleMvp(req) {
  let voter = readCookie(req, "mvp_vid");
  const headers = {};
  if (!voter) {
    voter = crypto.randomBytes(16).toString("hex");
    headers["Set-Cookie"] = voterCookie(voter);
  }

  const store = await readVotes();
  const poll = ensurePoll(store);

  if (req.method === "GET") return result(mvpPayload(poll, voter), 200, headers);
  if (req.method !== "POST") return result({ error: "method" }, 405, headers);

  let body;
  try {
    body = await readBody(req);
  } catch {
    return result({ error: "json" }, 400, headers);
  }

  const action = String(body.action || "");
  const adminActions = ["auth", "start", "pause", "resume", "close", "reset"];
  if (adminActions.includes(action)) {
    if (String(body.pin || "") !== startPin) return result({ error: "pin" }, 403, headers);
    if (action === "auth") return result({ ok: true }, 200, headers);
    const win = getWindow(poll);
    const now = new Date();
    if (action === "start") {
      if (win.started) return result(mvpPayload(poll, voter), 409, headers);
      poll.startedAt = now.toISOString();
      poll.endsAt = new Date(now.getTime() + durationHours * 3600 * 1000).toISOString();
      poll.paused = false;
      poll.remainingMs = durationHours * 3600 * 1000;
    } else if (action === "pause") {
      if (!win.open) return result(mvpPayload(poll, voter), 409, headers);
      poll.paused = true;
      poll.remainingMs = win.remainingMs;
    } else if (action === "resume") {
      if (!win.started || !win.paused || win.remainingMs <= 0) {
        return result(mvpPayload(poll, voter), 409, headers);
      }
      poll.paused = false;
      poll.endsAt = new Date(now.getTime() + poll.remainingMs).toISOString();
    } else if (action === "close") {
      if (!win.started || (!win.open && !win.paused)) {
        return result(mvpPayload(poll, voter), 409, headers);
      }
      poll.paused = false;
      poll.remainingMs = 0;
      poll.endsAt = now.toISOString();
    } else if (action === "reset") {
      store.polls[pollId] = emptyPoll();
      await saveVotes(store);
      return result(mvpPayload(store.polls[pollId], voter), 200, headers);
    }
    store.polls[pollId] = poll;
    await saveVotes(store);
    return result(mvpPayload(poll, voter), 200, headers);
  }

  const reqPoll = String(body.poll || "");
  if (reqPoll !== pollId) return result({ error: "invalid" }, 400, headers);

  const win = getWindow(poll);
  if (!win.started || !win.open) return result(mvpPayload(poll, voter), 403, headers);

  if (action === "unvote") {
    delete poll.ballots[voter];
    store.polls[pollId] = poll;
    await saveVotes(store);
    return result(mvpPayload(poll, voter), 200, headers);
  }

  const player = String(body.player || "");
  if (!allow.includes(player)) return result({ error: "invalid" }, 400, headers);
  poll.ballots[voter] = player;
  store.polls[pollId] = poll;
  await saveVotes(store);
  return result(mvpPayload(poll, voter), 200, headers);
}
