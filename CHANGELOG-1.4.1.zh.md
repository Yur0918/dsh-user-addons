# 1.4.1（2026-10-20）

## 兼容

- **会话格式 v4（DSH 0.2.x）**：会话日志改名为 `session.v4.jsonl.zstd`。用量看板（扫描 `~/.dsh/sessions`）与归档列表/预览此前只认 `session.jsonl(.zstd)`，在 0.2 上会统计为零、预览失败。
  - `sessionLogsUnderRoot` 接受 v4 两种拼写并优先使用。
- 声明 `engines.dsh: ">=0.1.1-rc.2 <0.3.0"`。

## 质检

- `node --test`：**19/19**（新增 1 例：v4 文件发现）
