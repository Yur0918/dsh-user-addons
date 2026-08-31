# dsh-user-addons

[English](README.md) | 中文

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的社区 Web 插件。

这个包是一个独立于 DSH 核心代码的双端插件，同时提供 Host 半侧和 Web 浏览器半侧。

## 功能

- 在 Web 对话输入区拖入或选择文件。模型支持图片时直接附加图片；其他文件保存到本地并附加路径。
- 归档会话管理：查找、归档和恢复 DSH 工作区会话。
- 本地模型与 token 用量面板，扫描 `~/.dsh/sessions` 生成统计。
- 图片能力检测接口，帮助 Web 客户端选择附件处理方式。

## 要求

- 已启用客户端模块加载器的 DSH Web profile。
- Node.js 22.19 或更高版本，与当前 DSH 开发基线一致。

## 安装

使用你的 DSH profile 所采用的插件／包安装方式安装本包，然后重启 Web profile，使其重新发现包元数据和 `lib/client.js` 浏览器 bundle。本包声明了 Web 客户端插件入口：

```json
{
  "dsh": {
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-locale"
      ]
    }
  }
}
```

从源码目录运行前，请确认已存在发布用的 `lib/client.js`，然后执行：

```sh
npm run check
```

## 本地接口

Host 半侧注册同源 `/addons/*` 接口：

- `GET /addons/health`
- `GET /addons/archive/list`
- `POST /addons/archive/archive`
- `POST /addons/archive/restore`
- `GET /addons/image-capability`
- `POST /addons/upload`
- `GET /addons/usage/summary`

上传大小上限为 100 MiB，文件名会在写入 DSH home 下的目录前进行清理。用量数据只从本地 DSH 会话日志读取；插件本身不发起网络请求。

## 开发

由于 DSH Web Host 会提供构建后的客户端 bundle，`lib/client.js` 会随包提交。请保持 Host 和 Client 半侧与所使用的 DSH 版本兼容，并在发布前执行 `npm run check`。

不要提交会话日志、上传文件、凭据、生成的任务状态或备份文件。

## 许可证

MIT
