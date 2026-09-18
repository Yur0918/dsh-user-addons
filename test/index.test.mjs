// 纯函数单测:命名清洗、首条 prompt 提取、用量折叠、zstd 多帧解析、归档预览摘要、版本号派生。
// 只测 lib/index.js 的顶层纯函数,不启动 webServer;除自身 package.json(只读)外不触碰文件系统。

import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { zstdCompressSync } from "node:zlib";
import {
  safeName,
  firstTextOf,
  foldLine,
  emptyFileFold,
  parseZstdFrames,
  decodeZstdLog,
  readOwnVersion,
  previewFromText,
} from "../lib/index.js";

// ── safeName ────────────────────────────────────────────────────────────────

test("safeName 替换路径/控制字符等危险字符", () => {
  assert.equal(safeName('a/b\\c:d*e?f"g<h>i|j'), "a_b_c_d_e_f_g_h_i_j");
});

test("safeName 剥离前导点号,全非法输入回退为 file", () => {
  assert.equal(safeName("..hidden"), "hidden");
  assert.equal(safeName(null), "file");
  assert.equal(safeName("..."), "file");
});

test("safeName 截断到 180 字符", () => {
  assert.equal(safeName("x".repeat(200)).length, 180);
});

// ── firstTextOf ─────────────────────────────────────────────────────────────

test("firstTextOf 返回首个非空 text 块(trim 后)", () => {
  const blocks = [
    { type: "image", url: "x" },
    { type: "text", text: "  你好  " },
    { type: "text", text: "第二条" },
  ];
  assert.equal(firstTextOf(blocks), "你好");
});

test("firstTextOf 对非数组或全空文本返回空串", () => {
  assert.equal(firstTextOf("nope"), "");
  assert.equal(firstTextOf([{ type: "text", text: "   " }]), "");
});

// ── foldLine ────────────────────────────────────────────────────────────────

test("foldLine 处理 session 头事件(createdAt/cwd 取自事件顶层)", () => {
  const fold = emptyFileFold();
  foldLine(fold, { type: "session", createdAt: 123, cwd: "/work/dir" });
  assert.equal(fold.createdAt, 123);
  assert.equal(fold.cwd, "/work/dir");
});

test("foldLine 处理标题事件(字符串与对象两种形态)", () => {
  const fold = emptyFileFold();
  foldLine(fold, { type: "session/title", data: "  标题A " });
  assert.equal(fold.title, "标题A");
  foldLine(fold, { type: "session/title", data: { title: "标题B" } });
  assert.equal(fold.title, "标题B");
});

test("foldLine 记录首条用户消息:超 80 字截断,上下文注入消息跳过", () => {
  const fold = emptyFileFold();
  foldLine(fold, {
    type: "user/message",
    data: { content: [{ type: "text", text: "Current runtime context ..." }] },
  });
  assert.equal(fold.firstUser, "");
  foldLine(fold, {
    type: "user/message",
    data: { content: [{ type: "text", text: "问:".concat("很长的问题描述".repeat(20)) }] },
  });
  assert.ok(fold.firstUser.length <= 81);
  assert.ok(fold.firstUser.endsWith("…"));
  assert.ok(fold.firstUser.startsWith("问:"));
});

test("foldLine 累计 assistant 用量:总账 + 模型桶 + 日期桶", () => {
  const fold = emptyFileFold();
  const time = new Date("2026-09-09T10:00:00Z").getTime();
  const assistantEvent = (n) => ({
    type: "assistant/message",
    time,
    data: {
      usage: { inputTokens: 100 * n, outputTokens: 50 * n, cacheReadTokens: 10 * n, cacheWriteTokens: 5 * n },
      message: { source: { provider: "deepseek", model: "chat" } },
    },
  });
  foldLine(fold, assistantEvent(1));
  foldLine(fold, assistantEvent(2));
  assert.equal(fold.calls, 2);
  assert.equal(fold.inputTokens, 300);
  assert.equal(fold.outputTokens, 150);
  const bucket = fold.models.get("deepseek/chat");
  assert.ok(bucket);
  assert.equal(bucket.calls, 2);
  assert.equal(bucket.cacheWriteTokens, 15);
  const day = fold.days.get("2026-09-09");
  assert.ok(day, "应生成当天日期桶");
  assert.equal(day.calls, 2);
  assert.equal(day.outputTokens, 150);
});

test("foldLine 忽略无 usage 的 assistant 消息与其他类型", () => {
  const fold = emptyFileFold();
  foldLine(fold, { type: "assistant/message", data: { usage: null } });
  foldLine(fold, { type: "tool/call", data: {} });
  assert.equal(fold.calls, 0);
  assert.equal(fold.models.size, 0);
});

// ── parseZstdFrames / decodeZstdLog ─────────────────────────────────────────

function frameOf(text) {
  return zstdCompressSync(Buffer.from(text, "utf8"));
}

test("parseZstdFrames 定位拼接的多帧边界", () => {
  const a = frameOf('{"type":"session"}\n');
  const b = frameOf("line2\n");
  const buf = Buffer.concat([a, b]);
  const { frames, tornFrom } = parseZstdFrames(buf);
  assert.equal(frames.length, 2);
  assert.deepEqual(frames[0], [0, a.length]);
  assert.deepEqual(frames[1], [a.length, a.length + b.length]);
  assert.equal(tornFrom, null);
});

test("parseZstdFrames 垃圾字节尾巴被忽略,保留完整帧且不误报 torn", () => {
  const a = frameOf("one\n");
  const junk = Buffer.from("not-a-zstd-frame");
  const { frames, tornFrom } = parseZstdFrames(Buffer.concat([a, junk]));
  assert.equal(frames.length, 1);
  assert.equal(tornFrom, null);
});

test("parseZstdFrames 帧头合法但内容截断时标记 tornFrom", () => {
  const a = frameOf("one\n");
  const b = frameOf("two\n");
  const torn = Buffer.concat([a, b.subarray(0, b.length - 3)]);
  const { frames, tornFrom } = parseZstdFrames(torn);
  assert.equal(frames.length, 1);
  assert.equal(tornFrom, a.length);
});

test("parseZstdFrames 空缓冲返回空结果", () => {
  assert.deepEqual(parseZstdFrames(Buffer.alloc(0)), { frames: [], tornFrom: null });
});

test("decodeZstdLog 解出全部帧文本;损坏尾帧只截断不报错", () => {
  const buf = Buffer.concat([frameOf('{"type":"session"}\n'), frameOf("line2\n")]);
  assert.equal(decodeZstdLog(buf), '{"type":"session"}\nline2\n');
  const withJunk = Buffer.concat([buf, Buffer.from("garbage")]);
  assert.equal(decodeZstdLog(withJunk), '{"type":"session"}\nline2\n');
});

test("readOwnVersion 从 package.json 派生版本号(不再硬编码)", () => {
  const v = readOwnVersion();
  assert.match(v, /^\d+\.\d+\.\d+/);
  // 与仓库 package.json 一致,而不是历史遗留的 "1.2.0"
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(v, pkg.version);
});

test("previewFromText 提取标题/首条用户消息/末尾轮次,跳过上下文注入", () => {
  const lines = [
    JSON.stringify({ type: "session", data: { createdAt: 1, cwd: "/x" } }),
    JSON.stringify({ type: "session/title", data: "调试 cordis 插件" }),
    JSON.stringify({ type: "user/message", data: { content: [{ type: "text", text: "Current runtime context …" }] } }),
    JSON.stringify({ type: "user/message", data: { content: [{ type: "text", text: "帮我看看为什么插件没加载" }] } }),
    JSON.stringify({ type: "assistant/message", data: { content: [{ type: "text", text: "先看日志。" }], usage: { inputTokens: 10, outputTokens: 5 } } }),
    JSON.stringify({ type: "user/message", data: { content: [{ type: "text", text: "日志在这里" }] } }),
    JSON.stringify({ type: "assistant/message", data: { content: [{ type: "text", text: "找到原因了:patch 没插行。" }], usage: { inputTokens: 1, outputTokens: 2 } } })
  ].join("\n");
  const p = previewFromText(lines);
  assert.equal(p.title, "调试 cordis 插件");
  assert.equal(p.firstUser, "帮我看看为什么插件没加载");
  assert.equal(p.turns.length, 4);
  assert.equal(p.turns[3].role, "assistant");
  assert.equal(p.turns[3].text, "找到原因了:patch 没插行。");
});

test("previewFromText 只保留末尾 7 轮;首条用户消息 200 字截断、轮次 400 字截断", () => {
  const long = "长".repeat(600);
  const lines = [];
  for (let i = 1; i <= 12; i++) lines.push(JSON.stringify({ type: "user/message", data: { content: [{ type: "text", text: "问题 " + i }] } }));
  // 第 1 条超长,验证 firstUser 截断到 200 字 + …;末轮超长,验证轮次 400 字截断
  lines.unshift(JSON.stringify({ type: "user/message", data: { content: [{ type: "text", text: long }] } }));
  const p = previewFromText(lines.join("\n"));
  assert.equal(p.turns.length, 7);
  assert.equal(p.turns[0].text, "问题 6");
  assert.equal(p.turns[6].text, "问题 12");
  assert.ok(p.firstUser.startsWith("长"));
  assert.equal(p.firstUser.length, 201);
  assert.ok(p.firstUser.endsWith("…"));
  const p2 = previewFromText(JSON.stringify({ type: "user/message", data: { content: [{ type: "text", text: long }] } }));
  assert.equal(p2.turns[0].text.length, 401);
  assert.ok(p2.turns[0].text.endsWith("…"));
});
