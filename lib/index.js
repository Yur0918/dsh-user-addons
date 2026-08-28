// dsh-user-addons host half: same-origin /addons/* HTTP routes over the
// webServer service. Zero package imports beyond node builtins so the
// profile loader can import this package from anywhere without a nested
// node_modules tree.
import { createReadStream } from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { zstdDecompressSync } from "node:zlib";

export const inject = ["webServer", "workspaceRegistry"];

const UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;

function dshHome() {
	if (process.env.DSH_HOME && process.env.DSH_HOME.trim() !== "") return process.env.DSH_HOME;
	return path.join(os.homedir(), ".dsh");
}

function safeName(raw) {
	const base = String(raw ?? "file").replace(/[\\/\u0000-\u001f"'`:*?<>|]/g, "_").replace(/^\.+/, "").trim();
	return base === "" ? "file" : base.slice(0, 180);
}

function stamp() {
	const now = new Date();
	const p = (n) => String(n).padStart(2, "0");
	return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

function readBody(req, limit) {
	return new Promise((resolve, reject) => {
		const declared = Number(req.headers["content-length"] ?? 0);
		if (Number.isFinite(declared) && declared > limit) {
			reject(Object.assign(new Error("too-large"), { statusCode: 413 }));
			req.resume();
			return;
		}
		const chunks = [];
		let total = 0;
		req.on("data", (chunk) => {
			total += chunk.length;
			if (total > limit) {
				reject(Object.assign(new Error("too-large"), { statusCode: 413 }));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});
}

function sendJson(res, status, value) {
	const body = JSON.stringify(value);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(body);
}

async function readJsonBody(req) {
	const buf = await readBody(req, 1024 * 1024);
	if (buf.length === 0) return {};
	try {
		const parsed = JSON.parse(buf.toString("utf8"));
		return parsed !== null && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

// ── session-log scanner ─────────────────────────────────────────────────────
// Folds every persisted session log once per (mtime,size) into per-model,
// per-day, and per-session token usage. The host process this plugin lives in
// is the only writer of those logs, so an in-memory cache stays coherent.

const scanCache = new Map();

function emptyFileFold() {
	return {
		title: "",
		createdAt: 0,
		updatedAt: 0,
		cwd: "",
		calls: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		models: new Map(),
		days: new Map()
	};
}

function foldLine(fold, event) {
	const type = event.type;
	const data = event.data;
	if (type === "session") {
		// the session header event carries its fields at the top level, not under data
		const header = data !== null && typeof data === "object" ? data : event;
		const created = Number(header.createdAt ?? event.createdAt ?? 0);
		if (created > 0) fold.createdAt = created;
		const cwd = typeof header.cwd === "string" ? header.cwd : (typeof event.cwd === "string" ? event.cwd : "");
		if (cwd !== "") fold.cwd = cwd;
		return;
	}
	if (type === "session/title") {
		if (typeof data === "string" && data.trim() !== "") fold.title = data.trim();
		else if (data && typeof data.title === "string" && data.title.trim() !== "") fold.title = data.title.trim();
		return;
	}
	if (type !== "assistant/message" || data === null || typeof data !== "object") return;
	const usage = data.usage;
	if (usage === null || typeof usage !== "object") return;
	const source = data.message?.source;
	const provider = typeof source?.provider === "string" ? source.provider : "unknown";
	const model = typeof source?.model === "string" ? source.model : "unknown";
	const input = Number(usage.inputTokens ?? 0) || 0;
	const output = Number(usage.outputTokens ?? 0) || 0;
	const cacheRead = Number(usage.cacheReadTokens ?? 0) || 0;
	const cacheWrite = Number(usage.cacheWriteTokens ?? 0) || 0;
	fold.calls += 1;
	fold.inputTokens += input;
	fold.outputTokens += output;
	fold.cacheReadTokens += cacheRead;
	fold.cacheWriteTokens += cacheWrite;
	const key = `${provider}/${model}`;
	const bucket = fold.models.get(key) ?? { provider, model, calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
	bucket.calls += 1;
	bucket.inputTokens += input;
	bucket.outputTokens += output;
	bucket.cacheReadTokens += cacheRead;
	bucket.cacheWriteTokens += cacheWrite;
	fold.models.set(key, bucket);
	const day = new Date(Number(event.time ?? 0) || 0);
	if (Number.isFinite(day.getTime()) && day.getTime() > 0) {
		const p = (n) => String(n).padStart(2, "0");
		const dayKey = `${day.getFullYear()}-${p(day.getMonth() + 1)}-${p(day.getDate())}`;
		const dayBucket = fold.days.get(dayKey) ?? { date: dayKey, calls: 0, inputTokens: 0, outputTokens: 0 };
		dayBucket.calls += 1;
		dayBucket.inputTokens += input;
		dayBucket.outputTokens += output;
		fold.days.set(dayKey, dayBucket);
	}
}

// DSH appends each log batch as one complete zstd frame, so a session log is
// a concatenation of frames. Node's one-shot decoder handles exactly one
// frame, so frame boundaries come from parsing the frame headers (RFC 8878).
const ZSTD_MAGIC = 0xfd2fb528;

function parseZstdFrames(buf) {
	const frames = [];
	let offset = 0;
	while (offset + 4 <= buf.length) {
		const start = offset;
		if (buf.readUInt32LE(offset) !== ZSTD_MAGIC) return { frames, tornFrom: start === 0 ? start : null };
		offset += 4;
		if (offset >= buf.length) return { frames, tornFrom: start };
		const descriptor = buf.readUInt8(offset);
		offset += 1;
		if ((descriptor & 24) !== 0) return { frames, tornFrom: start };
		const fcsFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictFlag = descriptor & 3;
		if (!singleSegment) offset += 1;
		offset += dictFlag === 3 ? 4 : dictFlag;
		offset += fcsFlag === 3 ? 8 : fcsFlag === 2 ? 4 : fcsFlag === 1 ? 2 : (singleSegment ? 1 : 0);
		let last = false;
		while (!last) {
			if (offset + 3 > buf.length) return { frames, tornFrom: start };
			const header = buf.readUIntLE(offset, 3);
			offset += 3;
			last = (header & 1) !== 0;
			offset += header >>> 3;
			if (offset > buf.length) return { frames, tornFrom: start };
		}
		if (checksum) offset += 4;
		if (offset > buf.length) return { frames, tornFrom: start };
		frames.push([start, offset]);
	}
	return { frames, tornFrom: null };
}

function decodeZstdLog(buf) {
	const { frames } = parseZstdFrames(buf);
	const parts = [];
	for (const [start, end] of frames) {
		try {
			parts.push(zstdDecompressSync(buf.subarray(start, end)));
		} catch {
			// torn or corrupt frame (a crash mid-append): keep what came before
			break;
		}
	}
	return Buffer.concat(parts).toString("utf8");
}

async function scanFile(filePath, stat) {
	const cached = scanCache.get(filePath);
	if (cached !== undefined && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.fold;
	const fold = emptyFileFold();
	try {
		const raw = await fsp.readFile(filePath);
		const text = filePath.endsWith(".zstd") ? decodeZstdLog(raw) : raw.toString("utf8");
		let start = 0;
		while (start < text.length) {
			const nl = text.indexOf("\n", start);
			const line = nl === -1 ? text.slice(start) : text.slice(start, nl);
			start = nl === -1 ? text.length : nl + 1;
			if (line.trim() === "") continue;
			try {
				foldLine(fold, JSON.parse(line));
			} catch {
				// truncated tail lines during live appends are expected
			}
		}
	} catch (error) {
		if (cached !== undefined) return cached.fold;
		throw error;
	}
	scanCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, fold });
	return fold;
}

async function listSessionLogs() {
	const roots = [];
	const sessionsRoot = path.join(dshHome(), "sessions");
	try {
		for (const entry of await fsp.readdir(sessionsRoot, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			roots.push(path.join(sessionsRoot, entry.name));
		}
	} catch {
		return [];
	}
	const logs = [];
	for (const root of roots) {
		try {
			for (const sessionDir of await fsp.readdir(root, { withFileTypes: true })) {
				if (!sessionDir.isDirectory() || !sessionDir.name.startsWith("session-")) continue;
				const base = path.join(root, sessionDir.name);
				for (const candidate of ["session.jsonl.zstd", "session.jsonl"]) {
					const file = path.join(base, candidate);
					try {
						const stat = await fsp.stat(file);
						if (stat.isFile()) logs.push({ id: sessionDir.name, file, stat });
						break;
					} catch {
						// try the next spelling
					}
				}
			}
		} catch {
			// unreadable workspace dir: skip
		}
	}
	return logs;
}

function mergeSummary(entries) {
	const totals = { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, sessions: 0 };
	const models = new Map();
	const days = new Map();
	const sessions = [];
	for (const { id, fold } of entries) {
		if (fold.calls === 0 && fold.title === "") continue;
		totals.sessions += 1;
		totals.calls += fold.calls;
		totals.inputTokens += fold.inputTokens;
		totals.outputTokens += fold.outputTokens;
		totals.cacheReadTokens += fold.cacheReadTokens;
		totals.cacheWriteTokens += fold.cacheWriteTokens;
		for (const bucket of fold.models.values()) {
			const key = `${bucket.provider}/${bucket.model}`;
			const merged = models.get(key) ?? { ...bucket, calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
			merged.calls += bucket.calls;
			merged.inputTokens += bucket.inputTokens;
			merged.outputTokens += bucket.outputTokens;
			merged.cacheReadTokens += bucket.cacheReadTokens;
			merged.cacheWriteTokens += bucket.cacheWriteTokens;
			models.set(key, merged);
		}
		for (const bucket of fold.days.values()) {
			const merged = days.get(bucket.date) ?? { ...bucket, calls: 0, inputTokens: 0, outputTokens: 0 };
			merged.calls += bucket.calls;
			merged.inputTokens += bucket.inputTokens;
			merged.outputTokens += bucket.outputTokens;
			days.set(bucket.date, merged);
		}
		sessions.push({
			id,
			title: fold.title,
			createdAt: fold.createdAt,
			updatedAt: fold.updatedAt,
			cwd: fold.cwd,
			calls: fold.calls,
			inputTokens: fold.inputTokens,
			outputTokens: fold.outputTokens,
			cacheReadTokens: fold.cacheReadTokens,
			cacheWriteTokens: fold.cacheWriteTokens,
			models: [...fold.models.values()].map((m) => `${m.provider}/${m.model}`)
		});
	}
	sessions.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
	return {
		totals,
		byModel: [...models.values()].sort((a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens)),
		byDay: [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
		topSessions: sessions.slice(0, 10),
		sessionCount: sessions.length
	};
}

async function scanAll() {
	const logs = await listSessionLogs();
	const entries = [];
	for (const { id, file, stat } of logs) {
		try {
			const fold = await scanFile(file, stat);
			fold.updatedAt = Math.max(fold.updatedAt || 0, stat.mtimeMs);
			entries.push({ id, fold });
		} catch {
			// unreadable/corrupt log: exclude from the summary
		}
	}
	return { entries, summary: mergeSummary(entries) };
}

// ── archive helpers ─────────────────────────────────────────────────────────

async function archiveList() {
	const registry = ctxWorkspaceRegistry;
	const archivedIds = [...(registry?.archivedSessionIds ?? [])];
	if (archivedIds.length === 0) return { ok: true, items: [] };
	const wanted = new Set(archivedIds);
	let scans = [];
	try {
		const { entries } = await scanAll();
		scans = entries;
	} catch {
		scans = [];
	}
	const byId = new Map(scans.map(({ id, fold }) => [id, fold]));
	const items = archivedIds.map((sessionId) => {
		const fold = byId.get(sessionId);
		return {
			sessionId,
			title: fold?.title || sessionId,
			createdAt: fold?.createdAt || null,
			updatedAt: fold?.updatedAt || null,
			cwd: fold?.cwd || null,
			calls: fold?.calls ?? 0,
			inputTokens: fold?.inputTokens ?? 0,
			outputTokens: fold?.outputTokens ?? 0,
			models: fold ? [...fold.models.values()].map((m) => `${m.provider}/${m.model}`) : []
		};
	});
	return { ok: true, items };
}

async function archiveRestore(sessionId) {
	const registry = ctxWorkspaceRegistry;
	if (registry === undefined) return { ok: false, error: "workspaceRegistry unavailable" };
	if (typeof sessionId !== "string" || sessionId.trim() === "") return { ok: false, error: "sessionId required" };
	let removed = false;
	try {
		await registry.enqueueOperation(async () => {
			const state = registry.requireState();
			const next = state.archivedSessionIds.filter((id) => id !== sessionId);
			if (next.length === state.archivedSessionIds.length) return;
			removed = true;
			await registry.setState({ ...state, archivedSessionIds: next });
		});
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
	if (!removed) return { ok: false, error: "session is not archived" };
	return { ok: true, sessionId };
}

async function archiveArchive(sessionId) {
	const registry = ctxWorkspaceRegistry;
	if (registry === undefined) return { ok: false, error: "workspaceRegistry unavailable" };
	if (typeof sessionId !== "string" || sessionId.trim() === "") return { ok: false, error: "sessionId required" };
	try {
		await registry.archiveSession(sessionId);
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
	return { ok: true, sessionId };
}

// ── image capability ────────────────────────────────────────────────────────

async function imageCapability(sessionId) {
	try {
		const agentLoop = ctx.get("agentLoop");
		const llm = ctx.get("llm");
		if (agentLoop === undefined || llm === undefined || typeof agentLoop.get !== "function") return { ok: true, supported: null };
		const agent = agentLoop.get(sessionId);
		const header = typeof agent?.session?.requestHeader === "function" ? agent.session.requestHeader() : undefined;
		const config = header?.config;
		if (config === null || config === undefined || typeof config.provider !== "string" || typeof config.model !== "string") return { ok: true, supported: null };
		const info = await llm.resolveModelInfo(config.provider, config.model);
		const modalities = info?.inputModalities;
		if (Array.isArray(modalities)) {
			return { ok: true, provider: config.provider, model: config.model, supported: modalities.includes("image") };
		}
		return { ok: true, supported: null };
	} catch (error) {
		return { ok: true, supported: null, error: error instanceof Error ? error.message : String(error) };
	}
}

// ── upload ──────────────────────────────────────────────────────────────────

function primaryWorkspacePath() {
	const registry = ctxWorkspaceRegistry;
	try {
		for (const entity of registry?.entities?.values?.() ?? []) {
			const candidate = entity?.record?.path ?? entity?.path;
			if (typeof candidate === "string" && candidate.trim() !== "") return candidate;
		}
	} catch {
		// fall through to the default location
	}
	return path.join(dshHome(), "uploads");
}

async function handleUpload(req, res, query) {
	const name = safeName(query.get("name") ?? "file");
	const body = await readBody(req, UPLOAD_LIMIT_BYTES);
	if (body.length === 0) {
		sendJson(res, 400, { ok: false, error: "empty-body" });
		return;
	}
	const dir = path.join(primaryWorkspacePath(), "dsh-uploads");
	const s = stamp();
	const rel = `dsh-uploads/${s}-${name}`;
	const target = path.join(dir, `${s}-${name}`);
	try {
		await fsp.mkdir(dir, { recursive: true });
		await fsp.writeFile(target, body);
	} catch (error) {
		sendJson(res, 500, { ok: false, error: "write-failed", detail: error instanceof Error ? error.message : String(error) });
		return;
	}
	sendJson(res, 200, { ok: true, path: target, relPath: rel, name, size: body.length });
}

// ── plugin entry ────────────────────────────────────────────────────────────

let ctx;
let ctxWorkspaceRegistry;

export function apply(pluginCtx) {
	ctx = pluginCtx;
	ctxWorkspaceRegistry = pluginCtx.get("workspaceRegistry");

	const dispose = pluginCtx.webServer.register({
		kind: "prefix",
		path: "/addons",
		handler: async (req, res) => {
			const url = new URL(req.url ?? "/", "http://x");
			const pathname = url.pathname;
			const query = url.searchParams;
			try {
				if (req.method === "GET" && pathname === "/addons/health") {
					sendJson(res, 200, { ok: true, addon: "dsh-user-addons", version: "1.1.1" });
					return;
				}
				if (req.method === "GET" && pathname === "/addons/archive/list") {
					sendJson(res, 200, await archiveList());
					return;
				}
				if (req.method === "POST" && pathname === "/addons/archive/restore") {
					const body = await readJsonBody(req);
					sendJson(res, 200, await archiveRestore(body.sessionId));
					return;
				}
				if (req.method === "POST" && pathname === "/addons/archive/archive") {
					const body = await readJsonBody(req);
					sendJson(res, 200, await archiveArchive(body.sessionId));
					return;
				}
				if (req.method === "GET" && pathname === "/addons/image-capability") {
					sendJson(res, 200, await imageCapability(query.get("sessionId") ?? ""));
					return;
				}
				if (req.method === "POST" && pathname === "/addons/upload") {
					await handleUpload(req, res, query);
					return;
				}
				if (req.method === "GET" && pathname === "/addons/usage/summary") {
					const { summary } = await scanAll();
					sendJson(res, 200, { ok: true, ...summary });
					return;
				}
				sendJson(res, 404, { ok: false, error: "not-found" });
			} catch (error) {
				const status = error?.statusCode ?? 500;
				sendJson(res, status, { ok: false, error: error instanceof Error ? error.message : String(error) });
			}
		}
	});

	pluginCtx.effect(() => dispose, "dsh-user-addons: /addons routes");
	pluginCtx.logger?.info?.("dsh-user-addons: /addons routes registered");
}
