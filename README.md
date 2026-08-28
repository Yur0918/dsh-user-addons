# dsh-user-addons

[English](#english) | [中文](#中文)

Community plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) web UI. Topic: [`dsh-plugin`](https://github.com/topics/dsh-plugin).

---

<a id="中文"></a>

## 中文

把任意文件**直接拖进 DSH Web 对话框**（拖拽 / 粘贴 / 点击选择均可）。图片在会话模型支持图片输入时作为原生附件随消息发送；其他格式（PDF、Office、代码、压缩包……）自动保存到工作区 `dsh-uploads/` 并把 `📎 已上传附件：/绝对路径` 回插到输入框——发送后 Agent 按路径直接读取分析。另附**归档会话管理**与**全量 Token 用量面板**。

> 兼容 DSH `0.1.x`（developer preview）。按官方 [CONTRIBUTING](https://github.com/deepseek-ai/deepseek-harness/blob/master/CONTRIBUTING.zh.md) 指引以社区插件形式发布。

### 功能

| 功能 | 说明 |
|---|---|
| 拖拽 / 粘贴 / 点击上传 | 文件拖入页面**任意位置**即可。PNG/JPEG/WebP/GIF 在模型支持时走官方原生图片附件轨道；其他格式存盘 + 路径回插 |
| 首屏（hero）兜底 | 官方 composer dock 只在已打开的会话内渲染；本插件页面级兜底：首屏拖拽/粘贴同样可用，立即落盘 + 悬浮 chip，路径标记在下一个会话草稿自动补齐 |
| 多会话仲裁 | `activeDockIntake` 保证拖拽只路由到当前活跃会话，不重复上传、不插错草稿 |
| 图片能力检测 | 查询当前会话模型是否支持图片输入，不支持时自动降级为"存盘 + 路径" |
| 粘贴去重 | 官方 composer 的 `onPaste` 原生处理图片；本插件只接管非图片文件，避免双份附加 |
| 原生轨道 ✕ 常驻 | 官方图片附件删除按钮默认 hover 才显示；运行时提取哈希类名注入覆盖，✕ 常驻可见 |
| 归档会话管理 | 设置页新增区块：搜索、查看、一键还原被归档的会话 |
| Token 用量面板 | 扫描 `~/.dsh/sessions` 全量日志（自实现 zstd 分帧解码，含断裂帧容错）：调用数 / 输入 / 输出 / 缓存命中、按模型、近 14 天柱状图、Top 会话；顶部另有今日用量 pill |
| 中英双语 | 全部 UI 文案跟随 `navigator.language` |

### 安装

**方式 A：bundle 安装（正式方式，v1.1.1 起）**

```sh
# 直接从 GitHub 安装（推荐）
dsh plugin --profile web add github:Yur0918/dsh-user-addons

# 或先 clone 再本地安装
git clone https://github.com/Yur0918/dsh-user-addons.git
dsh plugin --profile web add ./dsh-user-addons
```

> v1.1.1 起 `package.json` 声明了 `dsh.bundle`（`cordis.patch.yml` 插入 `user-addons` 行），`dsh plugin add` 会把本包追加进 profile 的 `dsh.profile.bundles`，host 半区 `/addons/*` 路由与 client 半区一并生效。
>
> **从 GitHub 安装的构建提示**：本插件 lib/ 为手写纯 JS（无构建步骤），不涉及 pnpm `prepare` 脚本与 allowBuilds 白名单。
> 安全提示：git 安装 = 安装时执行包代码，建议固定 commit —— `dsh plugin --profile web add github:Yur0918/dsh-user-addons#<sha>`。
>
> **验证安装**：`dsh --profile web --dump-config` 中出现 `dsh-user-addons` bundle 层即成功。

**方式 B：手动软链接（已验证）**

```sh
PLUGIN_SRC=$PWD   # 本仓库 checkout 位置
ln -s "$PLUGIN_SRC" ~/.dsh/profiles/node_modules/dsh-user-addons

cat >> ~/.dsh/profiles/web/cordis.patch.yml <<'EOF'
- insert:
    - id: user-addons
      name: 'dsh-user-addons'
EOF

# 重启 dsh web（launchd 场景）
launchctl kickstart -k gui/$(id -u)/com.deepseek.dsh
```

浏览器硬刷新（Cmd+Shift+R）后即可使用。验证：

```sh
curl http://127.0.0.1:3080/addons/health
# {"ok":true,"addon":"dsh-user-addons","version":"1.1.0"}
```

### 工作原理

```
拖拽/粘贴 → 全局捕获(document capture) → 分流
  ├─ 图片 & 模型支持 → conversation.createDraftImages → shell.addImages（原生附件）
  └─ 其他 / 不支持   → POST /addons/upload → <workspace>/dsh-uploads/
                        → 📎 路径回插草稿（无会话时排队，新会话排空）
                        → Agent 按路径读取
```

- `lib/client.js` — 浏览器半区：document capture 层、chip 状态机、hero 兜底轨道、设置页区块。
- `lib/index.js` — host 半区（零依赖，仅 Node 内置模块）：`webServer.register` 挂载同源路由 `/addons/upload`（≤100MB、时间戳安全文件名）、`/addons/image-capability`、`/addons/archive/*`、`/addons/usage/summary`。

### 已知限制

- 上传上限 100MB；fetch 无上传进度回调（本机回环影响小）。
- 暂不支持拖入文件夹（浏览器 `dataTransfer.files` 不含目录内容）。
- 路径标记是纯文本，Agent 需要文件读取权限（web profile 默认 Full access）。
- 官方 client 面为未打包 ESM（`window.__ModuleLoader__`），上游快速迭代可能需要适配。

### License

MIT © 2026 Yur0918

---

<a id="english"></a>

## English

Drop **any file straight into the DSH web chat** — drag & drop anywhere, paste, or click-to-pick. Images attach natively when the session model supports image input; every other format is saved into `<workspace>/dsh-uploads/` and its absolute path is inserted back into the composer draft (`📎 Uploaded attachment: /abs/path`), so the agent can read and analyze it right away. Ships with an **archived-session manager** and a **full token-usage dashboard**.

### Features

- Drag & drop / paste / click-to-pick uploads; native image attachment with per-session capability detection; non-image files saved to disk with a path marker.
- Hero-screen fallback: the official composer dock only renders inside an open session; page-level listeners keep drop & paste working on the fresh-app hero screen, queueing path markers for the next session draft.
- Multi-session arbitration (`activeDockIntake`) so a drop is handled exactly once by the active session.
- Paste dedupe against the official composer image handler; always-visible remove ✕ on the official image rail (runtime hashed-class CSS override).
- Archived-session manager (search / restore) and a token-usage dashboard (calls, input/output/cache tokens, per-model breakdown, 14-day chart, top sessions) folded from `~/.dsh/sessions` logs with a self-contained zstd frame decoder.
- i18n: English / 简体中文.

### Install

```sh
# Option A: bundle install (official, v1.1.1+)
dsh plugin --profile web add github:Yur0918/dsh-user-addons
# or local:
git clone https://github.com/Yur0918/dsh-user-addons.git
dsh plugin --profile web add ./dsh-user-addons

# Option B: manual symlink into ~/.dsh/profiles/node_modules/ + one insert row in ~/.dsh/profiles/web/cordis.patch.yml
# restart dsh web, then hard-refresh the browser
```

Since v1.1.1 the package declares a `dsh.bundle` manifest (`cordis.patch.yml`), so `dsh plugin add` appends it to the profile's `dsh.profile.bundles` and both the host `/addons/*` routes and the client half activate. The lib/ sources are hand-written plain JS — no build step, no pnpm allowBuilds needed. For supply-chain safety, pin a commit: `github:Yur0918/dsh-user-addons#<sha>`.

### Architecture

`lib/client.js` (browser half) captures drag/paste at document level in the capture phase, routes native images through the conversation API, and uploads everything else to the host half. `lib/index.js` (host half, zero dependencies beyond Node builtins) serves same-origin `/addons/*` routes over `webServer.register`.

### License

MIT
