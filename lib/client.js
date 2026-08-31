// dsh-user-addons browser half: file drop-upload dock, archived-session
// manager, and the model/token usage surfaces, all over the same-origin
// /addons/* routes served by the host half.
window.__ModuleLoader__.load({
	id: "dsh-user-addons",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");

		const ZH = (typeof navigator !== "undefined" && String(navigator.language || "").toLowerCase().startsWith("zh"));
		const T = ZH ? {
			dropTitle: "拖入文件到对话",
			dropHint: "图片作附件 · 其他格式自动存盘并附上路径",
			dropPick: "或点击选择",
			uploading: "上传中",
			done: "已附上",
			failed: "失败",
			retry: "重试",
			remove: "移除",
			tooLarge: (n) => "超过 " + n + "MB 上限",
			savedNoInput: "输入框不可用，已保存到 ",
			markerLine: (p, k, s) => "📎 已上传附件：" + p + " （" + k + " · " + s + "）",
			heroHint: "松手上传文件 · 打开会话后自动附上路径",
			imgUnsupported: "模型不支持图片 · 已存盘并附路径",
			archiveTitle: "归档任务",
			archiveDesc: "被归档的会话已从侧边栏隐藏。在这里查找、查看并还原它们；还原后会话会回到原来的工作区位置。",
			archiveSearch: "搜索归档会话…",
			archiveEmpty: "没有已归档的会话",
			archiveLoadFail: "加载失败",
			restore: "还原",
			restored: "已还原到侧边栏",
			restoreFail: "还原失败",
			refresh: "刷新",
			calls: "次调用",
			created: "创建",
			updated: "活动",
			usageTitle: "用量统计",
			usageDesc: "全部本地会话的模型调用与 token 用量（扫描 ~/.dsh/sessions 生成）。",
			totalCalls: "模型调用",
			totalInput: "输入 token",
			totalOutput: "输出 token",
			totalCacheRead: "缓存命中",
			totalSessions: "会话数",
			byModel: "按模型",
			byDay: "近 14 天",
			topSessions: "用量最高的会话",
			today: "今日",
			model: "模型",
			viewAll: "打开 设置 → 用量统计 查看全部",
			loading: "加载中…"
		} : {
			dropTitle: "Drop files into the chat",
			dropHint: "Images attach natively · other files are saved with their path",
			dropPick: "or click to pick",
			uploading: "uploading",
			done: "attached",
			failed: "failed",
			retry: "Retry",
			remove: "Remove",
			tooLarge: (n) => "exceeds the " + n + "MB limit",
			savedNoInput: "composer unavailable, saved to ",
			markerLine: (p, k, s) => "📎 Uploaded attachment: " + p + " (" + k + " · " + s + ")",
			heroHint: "Drop to upload · paths attach when you open a chat",
			imgUnsupported: "model has no image input · saved with path",
			archiveTitle: "Archived tasks",
			archiveDesc: "Archived sessions are hidden from the sidebar. Find and restore them here; a restored session returns to its original workspace slot.",
			archiveSearch: "Search archived sessions…",
			archiveEmpty: "No archived sessions",
			archiveLoadFail: "Failed to load",
			restore: "Restore",
			restored: "Restored to sidebar",
			restoreFail: "Restore failed",
			refresh: "Refresh",
			calls: "calls",
			created: "created",
			updated: "active",
			usageTitle: "Usage",
			usageDesc: "Model calls and token usage across all local sessions (folded from ~/.dsh/sessions).",
			totalCalls: "Model calls",
			totalInput: "Input tokens",
			totalOutput: "Output tokens",
			totalCacheRead: "Cache hits",
			totalSessions: "Sessions",
			byModel: "By model",
			byDay: "Last 14 days",
			topSessions: "Top sessions",
			today: "today",
			model: "Model",
			viewAll: "Open Settings → Usage for details",
			loading: "Loading…"
		};

		// ── shared helpers ────────────────────────────────────────────────────
		const CSS = `
.dua-dock,\.dua-dock *{box-sizing:border-box}
.dua-dock{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);padding:2px 0 8px;display:flex;flex-direction:column;gap:6px}
.dua-zone{border:1.5px dashed var(--dsw-alias-border-l3,#c4cad3);border-radius:12px;padding:8px 14px;display:flex;align-items:center;gap:10px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;cursor:pointer;background:transparent;text-align:left;width:100%;transition:border-color .15s ease,background .15s ease;font-family:inherit}
.dua-zone:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dua-zone[data-active="true"]{border-color:#3964fe;background:rgba(57,100,254,.08)}
.dua-zone-icon{font-size:16px;line-height:1}
.dua-zone-title{font-weight:500;color:var(--dsw-alias-label-primary)}
.dua-zone-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;margin-left:auto;white-space:nowrap}
.dua-items{display:flex;flex-wrap:wrap;gap:6px}
.dua-chip{display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l2-darkmode-thin,#3a3f45);background:var(--dsw-specific-input-major,#fff);border-radius:10px;padding:5px 8px;font-size:12px;line-height:16px;max-width:320px}
.dua-badge{width:30px;height:30px;border-radius:8px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;letter-spacing:.02em;flex:none;overflow:hidden}
.dua-badge img{width:100%;height:100%;object-fit:cover}
.dua-meta{min-width:0;display:flex;flex-direction:column}
.dua-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary)}
.dua-sub{color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}
.dua-status{font-size:12px;flex:none;color:var(--dsw-alias-label-secondary)}
.dua-status[data-state="uploading"]{display:inline-block;animation:dua-spin 1s linear infinite}
.dua-status[data-state="error"]{color:#d33}
.dua-x{border:none;background:var(--dsw-alias-button-contrast-fill,#e4e6eb);color:var(--dsw-alias-label-primary-inverted,#222);width:18px;height:18px;border-radius:50%;cursor:pointer;font-size:10px;line-height:1;padding:0;flex:none;display:flex;align-items:center;justify-content:center;opacity:.75}
.dua-x:hover{opacity:1}
.dua-retry{border:1px solid var(--dsw-alias-border-l2-darkmode-thin,#c9ced6);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;font-size:11px;padding:1px 8px;cursor:pointer;flex:none}
@keyframes dua-spin{to{transform:rotate(360deg)}}
.dua-section{padding:4px 8px 12px;display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}
.dua-h2{font-size:16px;font-weight:600;margin:0}
.dua-desc{color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.6;margin:0}
.dua-toolbar{display:flex;gap:8px;align-items:center}
.dua-input{flex:1;border:1px solid var(--dsw-alias-border-l2-darkmode-thin,#c9ced6);background:var(--dsw-specific-input-major,#fff);color:var(--dsw-alias-label-primary);border-radius:10px;padding:7px 12px;font-size:13px;font-family:inherit;outline:none}
.dua-input:focus{border-color:#3964fe}
.dua-btn{border:1px solid var(--dsw-alias-border-l2-darkmode-thin,#c9ced6);background:var(--dsw-specific-input-major,#fff);color:var(--dsw-alias-label-primary);border-radius:10px;padding:6px 14px;font-size:13px;cursor:pointer;font-family:inherit}
.dua-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dua-btn:disabled{opacity:.5;cursor:default}
.dua-btn-primary{border:none;background:#3964fe;color:#fff}
.dua-btn-primary:hover{background:#2f55d9}
.dua-list{display:flex;flex-direction:column;gap:8px;min-height:120px}
.dua-row{display:flex;align-items:center;gap:12px;border:1px solid var(--dsw-alias-border-l1,#e8eaee);border-radius:12px;padding:10px 14px;background:var(--dsw-alias-bg-layer-1,transparent)}
.dua-row-main{flex:1;min-width:0}
.dua-row-title{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary)}
.dua-row-sub{font-size:11.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.dua-tags{display:flex;gap:4px;margin-top:4px;flex-wrap:wrap}
.dua-tag{font-size:10.5px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2-darkmode-thin,#c9ced6);border-radius:6px;padding:0 6px;line-height:18px;white-space:nowrap}
.dua-empty{color:var(--dsw-alias-label-tertiary);text-align:center;padding:36px 0;font-size:13px}
.dua-error{color:#d33;padding:10px 12px;background:rgba(211,47,47,.07);border-radius:8px;font-size:12.5px}
.dua-ok{color:#17795e;padding:10px 12px;background:rgba(23,121,94,.08);border-radius:8px;font-size:12.5px}
.dua-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.dua-card{border:1px solid var(--dsw-alias-border-l1,#e8eaee);border-radius:12px;padding:10px 12px}
.dua-card-num{font-size:18px;font-weight:650;color:var(--dsw-alias-label-primary)}
.dua-card-label{font-size:11px;color:var(--dsw-alias-label-tertiary);margin-top:2px}
.dua-subhead{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);letter-spacing:.02em;margin:2px 0 -6px}
.dua-mtable{display:flex;flex-direction:column;gap:6px}
.dua-mrow{display:grid;grid-template-columns:minmax(140px,1.4fr) 2fr auto;gap:10px;align-items:center;font-size:12.5px}
.dua-mname{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary)}
.dua-mbarwrap{height:8px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover,#eef0f3);overflow:hidden}
.dua-mbar{height:100%;border-radius:4px;background:linear-gradient(90deg,#3964fe,#7aa0ff)}
.dua-mnum{color:var(--dsw-alias-label-tertiary);font-size:11.5px;white-space:nowrap}
.dua-chart{display:flex;align-items:flex-end;gap:4px;height:72px;padding-top:4px}
.dua-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0}
.dua-colbar{width:100%;border-radius:3px 3px 0 0;background:#3964fe;min-height:2px;opacity:.85}
.dua-colbar:hover{opacity:1}
.dua-collabel{font-size:9px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dua-sessrow{display:flex;gap:10px;align-items:baseline;font-size:12.5px;padding:4px 0;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3)}
.dua-sessrow:last-child{border-bottom:none}
.dua-sesstitle{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary)}
.dua-sessnum{color:var(--dsw-alias-label-tertiary);font-size:11.5px;white-space:nowrap}
.dua-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2-darkmode-thin,#c9ced6);border-radius:999px;padding:2px 10px;font-size:11.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1,transparent);cursor:pointer;font-family:inherit;line-height:18px}
.dua-pill:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dua-pill-dot{width:6px;height:6px;border-radius:50%;background:#3964fe;flex:none}
.dua-pop{position:absolute;right:0;top:calc(100% + 8px);z-index:1200;width:300px;background:var(--dsw-alias-bg-layer-2,#fff);border:1px solid var(--dsw-alias-border-l2-darkmode-thin,#c9ced6);border-radius:14px;box-shadow:var(--dsw-shadow-lv3,0 8px 28px rgba(0,0,0,.14));padding:12px 14px;display:flex;flex-direction:column;gap:8px;font-size:12px}
.dua-pop-anchor{position:relative;display:inline-flex}
.dua-skel{color:var(--dsw-alias-label-tertiary);padding:24px 0;text-align:center;font-size:13px}
.dua-hero-hint{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:1500;display:none;align-items:center;gap:10px;border:1.5px dashed #3964fe;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary);border-radius:14px;padding:10px 18px;font-size:13px;box-shadow:var(--dsw-shadow-lv3,0 8px 28px rgba(0,0,0,.14));max-width:min(520px,90vw);text-align:center}
.dua-hero-chips{position:fixed;left:50%;bottom:40px;transform:translateX(-50%);z-index:1500;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:min(720px,92vw);pointer-events:none}
.dua-hero-chip{pointer-events:auto;display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l2-darkmode-thin,#3a3f45);background:var(--dsw-alias-bg-layer-2,#fff);border-radius:10px;padding:5px 8px;font-size:12px;line-height:16px;max-width:320px;box-shadow:var(--dsw-shadow-lv2,0 4px 16px rgba(0,0,0,.10))}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			if (document.querySelector("style[data-plugin-css='dsh-user-addons']") !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-user-addons";
			tag.dataset.pluginCss = "dsh-user-addons";
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		function clearHeroChips() {
			for (const el of heroChipEls.splice(0)) { try { el.remove(); } catch {} }
		}
		function extOf(name) {
			const d = name.lastIndexOf(".");
			return (d <= 0 || d === name.length - 1) ? "" : name.slice(d + 1).toLowerCase();
		}
		function humanSize(b) {
			if (b < 1024) return b + " B";
			if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
			return (b / 1048576).toFixed(1) + " MB";
		}
		function humanTokens(n) {
			if (n < 1000) return String(n);
			if (n < 1000000) return (n / 1000).toFixed(1) + "k";
			return (n / 1000000).toFixed(2) + "M";
		}
		function fmtDate(ms) {
			if (!ms) return "—";
			try {
				const d = new Date(Number(ms));
				const p = (n) => String(n).padStart(2, "0");
				return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
			} catch { return "—"; }
		}
		const EXT_COLORS = [
			[/^pdf$/, "#c6343d"], [/^(doc|docx|rtf|odt)$/, "#2f6fd0"], [/^(xls|xlsx|csv|ods|numbers)$/, "#1f8a4c"],
			[/^(ppt|pptx|key|odp)$/, "#d2691e"], [/^(zip|rar|7z|tar|gz|bz2|xz|tgz)$/, "#8a6d1f"],
			[/^(md|markdown|txt|log|json|ya?ml|toml|ini|conf)$/, "#4b7f9e"],
			[/^(png|jpe?g|gif|webp|svg|avif|heic|bmp|ico|tiff?)$/, "#a04fb0"],
			[/^(js|jsx|ts|tsx|py|rb|go|rs|java|kt|swift|c|h|cpp|cs|php|sh|sql|mjs)$/, "#5a7c2e"]
		];
		function extColor(ext) {
			for (const e of EXT_COLORS) if (e[0].test(ext)) return e[1];
			return "#6b7280";
		}

		async function apiGet(path) {
			const r = await fetch(path, { headers: { accept: "application/json" }, credentials: "same-origin" });
			const j = await r.json().catch(() => ({ ok: false, error: "bad-response" }));
			if (!r.ok || j.ok === false) throw new Error(j.error || ("HTTP " + r.status));
			return j;
		}
		async function apiPost(path, body) {
			const r = await fetch(path, {
				method: "POST",
				headers: { "content-type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify(body || {})
			});
			const j = await r.json().catch(() => ({ ok: false, error: "bad-response" }));
			if (!r.ok || j.ok === false) throw new Error(j.error || ("HTTP " + r.status));
			return j;
		}
		async function uploadFile(file) {
			const r = await fetch("/addons/upload?name=" + encodeURIComponent(file.name), {
				method: "POST",
				body: file,
				credentials: "same-origin"
			});
			const j = await r.json().catch(() => ({ ok: false, error: "bad-response" }));
			if (!r.ok || j.ok !== true) {
				const err = new Error(j.error || ("HTTP " + r.status));
				err.code = j.error;
				throw err;
			}
			return j;
		}

		// shared usage cache for the pill + the settings section
		const usageCache = { at: 0, loading: null, data: null, error: null };
		function loadUsage(force) {
			const now = Date.now();
			if (!force && usageCache.data !== null && now - usageCache.at < 60000) return Promise.resolve(usageCache.data);
			if (!force && usageCache.loading !== null) return usageCache.loading;
			usageCache.loading = apiGet("/addons/usage/summary")
				.then((data) => { usageCache.data = data; usageCache.at = now; usageCache.error = null; return data; })
				.catch((e) => { usageCache.error = e; throw e; })
				.finally(() => { usageCache.loading = null; });
			return usageCache.loading;
		}

		let activeDockIntake = null;
		const pendingHeroMarkers = [];

		// ── feature 1: drop-upload dock ───────────────────────────────────────
		function HeroDropHint({ active, items, heroChipEls }) {
			const [hint] = React.useState(() => {
				const el = document.createElement("div");
				el.className = "dua-hero-hint";
				el.textContent = T.heroHint;
				document.body.appendChild(el);
				heroChipEls.push(el);
				return el;
			});
			React.useEffect(() => () => { try { hint.remove(); } catch {} }, [hint]);
			React.useEffect(() => { hint.style.display = active ? "flex" : "none"; }, [active, hint]);
			return null;
		}

		const NATIVE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

		function FileChip(p) {
			const item = p.item;
			const badge = item.ext !== "" ? item.ext.toUpperCase().slice(0, 4) : "FILE";
			const sub = [item.ext !== "" ? "." + item.ext : "", humanSize(item.size)].filter(Boolean).join(" · ");
			const status = { uploading: "⟳", done: "✓", error: "✗" }[item.status] || "";
			const subText = item.status === "error" && item.error !== "" ? item.error : (item.note !== "" ? item.note : sub);
			return React.createElement("div", { className: "dua-chip", title: item.path !== "" ? item.path : (item.error !== "" ? item.error : item.file.name) },
				React.createElement("div", { className: "dua-badge", style: { background: extColor(item.ext) } },
					item.thumb !== "" ? React.createElement("img", { src: item.thumb, alt: "" }) : badge),
				React.createElement("div", { className: "dua-meta" },
					React.createElement("span", { className: "dua-name" }, item.file.name),
					React.createElement("span", { className: "dua-sub" }, subText)),
				item.status === "error" ? React.createElement("button", { className: "dua-retry", type: "button", onClick: p.onRetry }, T.retry) : null,
				React.createElement("span", { className: "dua-status", "data-state": item.status }, status),
				React.createElement("button", { className: "dua-x", type: "button", "aria-label": T.remove + " " + item.file.name, onClick: p.onRemove }, "✕"));
		}

		function DropDock(p) {
			const heroChipEls = [];
			const [items, setItems] = React.useState([]);
			const [active, setActive] = React.useState(false);
			const seqRef = React.useRef(0);
			const pickRef = React.useRef(null);
			const depsRef = React.useRef(p.deps);
			React.useEffect(() => { depsRef.current = p.deps; });

			const patchItem = React.useCallback((id, patch) => {
				setItems((prev) => prev.map((e) => e.id === id ? Object.assign({}, e, patch) : e));
			}, []);
			const insertMarker = React.useCallback((marker) => {
				const shell = depsRef.current.ensureShell();
				if (!shell) return false;
				const draft = String(shell.snapshot.draft || "");
				const next = draft.replace(/\s+$/, "") + "\n" + marker + " ";
				shell.setDraft(next);
				return true;
			}, []);
			const removeItem = React.useCallback((id) => {
				setItems((prev) => {
					const target = prev.find((e) => e.id === id);
					const rest = prev.filter((e) => e.id !== id);
					if (target) {
						if (target.thumb !== "") { try { URL.revokeObjectURL(target.thumb); } catch {} }
						if (target.status === "done" && target.marker !== "") {
							const s = depsRef.current.ensureShell();
							if (s) {
								const d = String(s.snapshot.draft || "");
								if (d.indexOf(target.marker) !== -1) s.setDraft(d.replace(target.marker, "").replace(/\n{3,}/g, "\n\n").trim());
							}
						}
					}
					return rest;
				});
			}, []);
			const markFailed = React.useCallback((id, reason) => patchItem(id, { status: "error", error: reason }), [patchItem]);
			const uploadOne = React.useCallback((entry, note) => {
				patchItem(entry.id, { status: "uploading", error: "", note: note || "" });
				uploadFile(entry.file)
					.then((res) => {
						const marker = T.markerLine(String(res.path), entry.ext !== "" ? entry.ext : (ZH ? "文件" : "file"), humanSize(entry.size));
						let ins = insertMarker(marker);
						if (!ins) { pendingHeroMarkers.push(marker); ins = true; }
						patchItem(entry.id, ins
							? { status: "done", path: String(res.path), marker, note: note || "" }
							: { status: "error", path: String(res.path), error: T.savedNoInput + res.path });
					})
					.catch((err) => {
						const code = err && err.code;
						markFailed(entry.id, code === "too-large" ? T.tooLarge(100) : (err instanceof Error ? err.message : String(err)));
					});
			}, [insertMarker, markFailed, patchItem]);
			const startUploads = React.useCallback((files, note) => {
				if (files.length === 0) return;
				const created = files.map((f) => {
					seqRef.current += 1;
					const isImg = NATIVE_IMAGE_TYPES.indexOf(f.type) !== -1;
					let thumb = "";
					if (isImg && typeof URL !== "undefined" && URL.createObjectURL) {
						try { thumb = URL.createObjectURL(f); } catch {}
					}
					return { id: "dua-" + Date.now() + "-" + seqRef.current, file: f, ext: extOf(f.name), size: f.size, status: "uploading", path: "", marker: "", error: "", note: note || "", thumb };
				});
				setItems((prev) => prev.concat(created));
				for (const e of created) uploadOne(e, note);
			}, [uploadOne]);
			const addNativeImages = React.useCallback((images) => {
				try {
					const deps = depsRef.current;
					const drafts = deps.conv.createDraftImages(images);
					const s = deps.ensureShell();
					const added = s ? s.addImages(drafts.map((d) => d.id)) : false;
					if (!added) deps.conv.releaseDraftImages(drafts);
				} catch (e) { console.error("[user-addons] image intake failed:", e); }
			}, []);
			const intake = React.useCallback((files) => {
				const deps = depsRef.current;
				if (!files || files.length === 0) return;
				const ok = deps.ensureConv();
				const native = [], other = [];
				for (const f of files) (NATIVE_IMAGE_TYPES.indexOf(f.type) !== -1 ? native : other).push(f);
				if (native.length > 0 && ok) {
					const sid = deps.sessionId || "";
					apiGet("/addons/image-capability?sessionId=" + encodeURIComponent(sid))
						.catch(() => null)
						.then((cap) => {
							const supported = !(cap && cap.ok === true && cap.supported === false);
							if (supported) { addNativeImages(native); startUploads(other, ""); }
							else startUploads(native.concat(other), T.imgUnsupported);
						});
					return;
				}
				startUploads(native.length > 0 ? native.concat(other) : other, "");
			}, [addNativeImages, startUploads]);

			React.useEffect(() => {
				activeDockIntake = intake;
				let depth = 0;
				const hasFiles = (e) => !!(e.dataTransfer && e.dataTransfer.types && Array.prototype.indexOf.call(e.dataTransfer.types, "Files") !== -1);
				const claim = (e) => { e.preventDefault(); e.stopImmediatePropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; };
				const enter = (e) => { if (activeDockIntake !== intake || !hasFiles(e)) return; claim(e); depth += 1; setActive(true); };
				const over = (e) => { if (activeDockIntake !== intake || !hasFiles(e)) return; claim(e); };
				const leave = (e) => { if (activeDockIntake !== intake || !hasFiles(e)) return; claim(e); depth = Math.max(0, depth - 1); if (depth === 0) setActive(false); };
				const drop = (e) => {
					if (activeDockIntake !== intake || !hasFiles(e)) return;
					claim(e); depth = 0; setActive(false);
					const dt = e.dataTransfer;
					intake(dt && dt.files ? Array.from(dt.files) : []);
				};
				const end = () => { depth = 0; setActive(false); };
				const paste = (e) => {
					if (activeDockIntake !== intake) return;
					const files = e.clipboardData && e.clipboardData.files;
					if (!files || files.length === 0) return;
					const target = e.target;
					const inEditor = target !== null && target !== undefined && typeof target.closest === "function" && target.closest('[contenteditable="true"],input,textarea') !== null;
					if (inEditor) {
						// the official composer attaches pasted images natively; take only the rest
						const others = Array.from(files).filter((f) => NATIVE_IMAGE_TYPES.indexOf(f.type) === -1);
						if (others.length > 0) intake(others);
						return;
					}
					intake(Array.from(files));
				};
				document.addEventListener("dragenter", enter, true);
				document.addEventListener("dragover", over, true);
				document.addEventListener("dragleave", leave, true);
				document.addEventListener("drop", drop, true);
				window.addEventListener("dragend", end);
				document.addEventListener("paste", paste, true);
				return () => {
					if (activeDockIntake === intake) activeDockIntake = null;
					document.removeEventListener("dragenter", enter, true);
					document.removeEventListener("dragover", over, true);
					document.removeEventListener("dragleave", leave, true);
					document.removeEventListener("drop", drop, true);
					window.removeEventListener("dragend", end);
					document.removeEventListener("paste", paste, true);
				};
			}, [intake]);

			React.useEffect(() => {
				if (pendingHeroMarkers.length === 0) return;
				const tryDrain = () => {
					if (pendingHeroMarkers.length === 0) return true;
					const shell = depsRef.current.ensureShell();
					if (!shell) return false;
					let draft = String(shell.snapshot.draft || "").replace(/\s+$/, "");
					while (pendingHeroMarkers.length > 0) draft += "\n" + pendingHeroMarkers.shift();
					shell.setDraft(draft + " ");
					clearHeroChips();
					return true;
				};
				if (tryDrain()) return;
				const t1 = setTimeout(tryDrain, 1500);
				const t2 = setTimeout(tryDrain, 4000);
				return () => { clearTimeout(t1); clearTimeout(t2); };
			}, []);

			const heroVisible = p.deps.sessionId === undefined || p.deps.sessionId === "";
			return React.createElement("div", { className: "dua-dock" },
				heroVisible ? React.createElement(HeroDropHint, { active, items, heroChipEls }) : null,
				items.length > 0 ? React.createElement("div", { className: "dua-items" },
					items.map((item) => React.createElement(FileChip, {
						key: item.id, item,
						onRemove: () => removeItem(item.id),
						onRetry: () => uploadOne(item, item.note)
					}))) : null,
				React.createElement("div", { className: "dua-zone", "data-active": active ? "true" : "false", onClick: () => { if (pickRef.current) pickRef.current.click(); } },
					React.createElement("span", { className: "dua-zone-icon", "aria-hidden": "true" }, "🗂️"),
					React.createElement("span", { className: "dua-zone-title" }, T.dropTitle),
					React.createElement("span", { style: { color: "var(--dsw-alias-label-tertiary)" } }, T.dropHint),
					React.createElement("span", { className: "dua-zone-hint" }, T.dropPick),
					React.createElement("input", {
						ref: pickRef, type: "file", multiple: true, style: { display: "none" },
						onChange: (e) => { intake(Array.from(e.target.files || [])); e.target.value = ""; }
					})));
		}

		// ── feature 2: archived-task manager (settings section) ───────────────
		function ArchiveSection() {
			const [items, setItems] = React.useState(null);
			const [error, setError] = React.useState("");
			const [query, setQuery] = React.useState("");
			const [notice, setNotice] = React.useState("");
			const [busy, setBusy] = React.useState("");
			const reload = React.useCallback(() => {
				setNotice(""); setError("");
				apiGet("/addons/archive/list")
					.then((res) => setItems(res.items || []))
					.catch((e) => { setError(T.archiveLoadFail + ": " + (e instanceof Error ? e.message : String(e))); setItems([]); });
			}, []);
			React.useEffect(reload, [reload]);
			const restore = (sessionId) => {
				setBusy(sessionId); setNotice(""); setError("");
				apiPost("/addons/archive/restore", { sessionId })
					.then(() => {
						setItems((prev) => (prev || []).filter((s) => s.sessionId !== sessionId));
						setNotice(T.restored);
						try {
							const workspaces = ctxGet("workspaces");
							if (workspaces && typeof workspaces.refresh === "function") workspaces.refresh();
						} catch {}
					})
					.catch((e) => setError(T.restoreFail + ": " + (e instanceof Error ? e.message : String(e))))
					.finally(() => setBusy(""));
			};
			const q = query.trim().toLowerCase();
			const shown = (items || []).filter((s) => q === "" ||
				(s.title || "").toLowerCase().indexOf(q) !== -1 ||
				s.sessionId.toLowerCase().indexOf(q) !== -1 ||
				(s.cwd || "").toLowerCase().indexOf(q) !== -1);
			return React.createElement("div", { className: "dua-section" },
				React.createElement("h2", { className: "dua-h2" }, T.archiveTitle),
				React.createElement("p", { className: "dua-desc" }, T.archiveDesc),
				React.createElement("div", { className: "dua-toolbar" },
					React.createElement("input", { className: "dua-input", placeholder: T.archiveSearch, value: query, onChange: (e) => setQuery(e.target.value) }),
					React.createElement("button", { className: "dua-btn", type: "button", onClick: reload }, T.refresh)),
				notice ? React.createElement("div", { className: "dua-ok" }, notice) : null,
				error ? React.createElement("div", { className: "dua-error" }, error) : null,
				items === null
					? React.createElement("div", { className: "dua-skel" }, T.loading)
					: shown.length === 0
						? React.createElement("div", { className: "dua-empty" }, T.archiveEmpty)
						: React.createElement("div", { className: "dua-list" }, shown.map((s) => React.createElement("div", { key: s.sessionId, className: "dua-row" },
							React.createElement("div", { className: "dua-row-main" },
								React.createElement("div", { className: "dua-row-title", title: s.title + "\n" + s.sessionId }, s.title || s.sessionId),
								React.createElement("div", { className: "dua-row-sub" },
									[
										s.createdAt ? T.created + " " + fmtDate(s.createdAt) : "",
										s.updatedAt ? T.updated + " " + fmtDate(s.updatedAt) : "",
										s.calls > 0 ? s.calls + " " + T.calls + " · " + humanTokens(s.inputTokens + s.outputTokens) + " tok" : ""
									].filter(Boolean).join(" · ")),
								s.models.length > 0 ? React.createElement("div", { className: "dua-tags" },
									s.models.slice(0, 3).map((m) => React.createElement("span", { key: m, className: "dua-tag" }, m))) : null),
							React.createElement("button", { className: "dua-btn dua-btn-primary", type: "button", disabled: busy === s.sessionId, onClick: () => restore(s.sessionId) }, T.restore)))));
		}

		// ── feature 3: usage dashboard (settings section) ─────────────────────
		function StatCard({ num, label }) {
			return React.createElement("div", { className: "dua-card" },
				React.createElement("div", { className: "dua-card-num" }, num),
				React.createElement("div", { className: "dua-card-label" }, label));
		}
		function UsageSection() {
			const [data, setData] = React.useState(null);
			const [error, setError] = React.useState("");
			const reload = React.useCallback((force) => {
				setError("");
				loadUsage(force)
					.then(setData)
					.catch((e) => setError(e instanceof Error ? e.message : String(e)));
			}, []);
			React.useEffect(() => { reload(false); }, [reload]);
			if (error !== "") return React.createElement("div", { className: "dua-section" },
				React.createElement("h2", { className: "dua-h2" }, T.usageTitle),
				React.createElement("div", { className: "dua-error" }, T.archiveLoadFail + ": " + error),
				React.createElement("button", { className: "dua-btn", type: "button", onClick: () => reload(true) }, T.refresh));
			if (data === null) return React.createElement("div", { className: "dua-section" },
				React.createElement("h2", { className: "dua-h2" }, T.usageTitle),
				React.createElement("div", { className: "dua-skel" }, T.loading));
			const t = data.totals || {};
			const byModel = data.byModel || [];
			const maxModel = Math.max(1, ...byModel.map((m) => m.inputTokens + m.outputTokens));
			const days = (data.byDay || []).slice(-14);
			const maxDay = Math.max(1, ...days.map((d) => d.inputTokens + d.outputTokens));
			const totals = t.inputTokens + t.outputTokens;
			return React.createElement("div", { className: "dua-section" },
				React.createElement("h2", { className: "dua-h2" }, T.usageTitle),
				React.createElement("p", { className: "dua-desc" }, T.usageDesc),
				React.createElement("div", { className: "dua-cards" },
					React.createElement(StatCard, { num: humanTokens(totals), label: "Total tokens" }),
					React.createElement(StatCard, { num: humanTokens(t.inputTokens || 0), label: T.totalInput }),
					React.createElement(StatCard, { num: humanTokens(t.outputTokens || 0), label: T.totalOutput }),
					React.createElement(StatCard, { num: humanTokens(t.cacheReadTokens || 0), label: T.totalCacheRead }),
					React.createElement(StatCard, { num: String(t.calls || 0), label: T.totalCalls }),
					React.createElement(StatCard, { num: String(t.sessions || 0), label: T.totalSessions })),
				React.createElement("div", { className: "dua-subhead" }, T.byModel),
				React.createElement("div", { className: "dua-mtable" }, byModel.slice(0, 8).map((m) => React.createElement("div", { key: m.provider + "/" + m.model, className: "dua-mrow" },
					React.createElement("span", { className: "dua-mname", title: m.provider + "/" + m.model }, m.model),
					React.createElement("div", { className: "dua-mbarwrap" },
						React.createElement("div", { className: "dua-mbar", style: { width: Math.max(2, Math.round((m.inputTokens + m.outputTokens) / maxModel * 100)) + "%" } })),
					React.createElement("span", { className: "dua-mnum" }, humanTokens(m.inputTokens + m.outputTokens) + " tok · " + m.calls + " " + T.calls)))),
				React.createElement("div", { className: "dua-subhead" }, T.byDay),
				React.createElement("div", { className: "dua-chart" }, days.map((d) => React.createElement("div", { key: d.date, className: "dua-col", title: d.date + " · " + humanTokens(d.inputTokens + d.outputTokens) + " tok · " + d.calls + " " + T.calls },
					React.createElement("div", { className: "dua-colbar", style: { height: Math.max(2, Math.round((d.inputTokens + d.outputTokens) / maxDay * 64)) + "px" } }),
					React.createElement("span", { className: "dua-collabel" }, d.date.slice(5))))),
				React.createElement("div", { className: "dua-subhead" }, T.topSessions),
				React.createElement("div", null, (data.topSessions || []).map((s) => React.createElement("div", { key: s.id, className: "dua-sessrow" },
					React.createElement("span", { className: "dua-sesstitle", title: (s.title || s.id) + "\n" + s.id }, s.title || s.id),
					React.createElement("span", { className: "dua-sessnum" }, humanTokens(s.inputTokens + s.outputTokens) + " tok · " + s.calls + " " + T.calls)))),
				React.createElement("div", null,
					React.createElement("button", { className: "dua-btn", type: "button", onClick: () => reload(true) }, T.refresh)));
		}

		// ── feature 4: header usage pill ──────────────────────────────────────
		function todayKey() {
			const d = new Date();
			const p = (n) => String(n).padStart(2, "0");
			return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
		}
		function UsagePill() {
			const [open, setOpen] = React.useState(false);
			const [snap, setSnap] = React.useState(null);
			React.useEffect(() => {
				let alive = true;
				loadUsage(false).then((d) => { if (alive) setSnap(d); }).catch(() => {});
				return () => { alive = false; };
			}, [open]);
			// keep today's figures current while the session stays open; the
			// server-side mtime cache makes each forced refresh cheap
			React.useEffect(() => {
				const timer = setInterval(() => {
					loadUsage(true).then((d) => setSnap(d)).catch(() => {});
				}, 60000);
				return () => clearInterval(timer);
			}, []);
			if (snap === null) return null;
			const today = (snap.byDay || []).find((d) => d.date === todayKey());
			const tokens = today ? today.inputTokens + today.outputTokens : 0;
			const calls = today ? today.calls : 0;
			// a zero day still renders: a vanished pill reads as "broken", not "idle"
			return React.createElement("span", { className: "dua-pop-anchor" },
				React.createElement("button", { className: "dua-pill", type: "button", onClick: () => setOpen(!open) },
					React.createElement("span", { className: "dua-pill-dot" }),
					T.today + " " + humanTokens(tokens) + " tok · " + calls + " " + T.calls),
				open ? React.createElement("div", { className: "dua-pop" },
					React.createElement("div", { style: { fontWeight: 600, color: "var(--dsw-alias-label-primary)" } }, T.byModel),
					(snap.byModel || []).slice(0, 4).map((m) => React.createElement("div", { key: m.provider + "/" + m.model, style: { display: "flex", justifyContent: "space-between", gap: 8 } },
						React.createElement("span", { title: m.provider + "/" + m.model, style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, m.model),
						React.createElement("span", { style: { color: "var(--dsw-alias-label-tertiary)", flex: "none" } }, humanTokens(m.inputTokens + m.outputTokens) + " tok"))),
					React.createElement("div", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 11 } }, T.viewAll)) : null);
		}

		// ── plugin apply ──────────────────────────────────────────────────────
		let pluginCtx = null;
		function ctxGet(key) {
			try { return pluginCtx !== null ? pluginCtx.get(key) : undefined; } catch { return undefined; }
		}

		exports.inject = ["slots"];

		exports.apply = function apply(ctx) {
			pluginCtx = ctx;
			ensureStyles();
			const slots = ctx.get("slots");
			if (slots === undefined) return;

			ctx.effect(() => slots.inject("conversation.composer.dock", () => {
				const makeDeps = (sessionId) => ({
					conv: null,
					sessionId,
					ensureConv() {
						if (this.conv !== null && this.conv !== undefined) return this.conv;
						const c = ctxGet("conversation");
						if (c !== undefined && c !== null && typeof c.createDraftImages === "function") { this.conv = c; return this.conv; }
						return null;
					},
					ensureShell() {
						if (!this.ensureConv()) return null;
						try {
							const hub = this.conv.input;
							if (hub !== undefined && hub !== null && typeof hub.shell === "function") return hub.shell(sessionId);
						} catch (err) { console.error("[user-addons] shell resolve failed:", err); }
						return null;
					}
				});
				slots.register({
					name: "conversation.composer.dock", id: "user-addons-drop", order: 40,
					inject: (sessionId) => ({ deps: makeDeps(sessionId) })
				}, DropDock);
			}), "user-addons: drop dock");

			ctx.effect(() => slots.inject("settings.section", () => {
				slots.register({ name: "settings.section", id: "user-addons-archive", order: 25, label: () => T.archiveTitle }, ArchiveSection);
			}), "user-addons: archive section");

			ctx.effect(() => slots.inject("settings.section", () => {
				slots.register({ name: "settings.section", id: "user-addons-usage", order: 26, label: () => T.usageTitle }, UsageSection);
			}), "user-addons: usage section");

			ctx.effect(() => slots.inject("conversation.session.header.utilities", () => {
				slots.register({ name: "conversation.session.header.utilities", id: "user-addons-usage-pill", order: 60 }, UsagePill);
			}), "user-addons: usage pill");
		};

		return module.exports;
	}
});
