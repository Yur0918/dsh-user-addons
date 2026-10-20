# 1.4.2（2026-10-20）

## 加固

- **归档恢复改走公开接口**：`archiveRestore` 此前直接调用 `workspaceRegistry` 的 `enqueueOperation()` / `requireState()` / `setState()`，
  这三个在 0.1.6-alpha.1 与 0.2.1-rc.2 的公开类型里**都是 `private`**——等于一直踩内部实现。
  - 现在优先调用公开的 `unarchiveSession(sessionId)`（两代都有），仅在旧宿主缺少该方法时回退原私有路径。
  - 保留原有语义：未归档的会话仍返回 `session is not archived`；错误信息原样透出。

## 质检

- `node --test`：**23/23**（新增 4 例：公开面优先且不触碰私有面、未归档报错、旧宿主回退、两种面都缺时的明确错误）
