# dsh-user-addons 1.2.1 变更说明

## 修复：启动即崩溃（issue #1）
- 打包 `files` 字段补入 `cordis.patch.yml`。此前该文件未随包发布，dsh 加载 bundle overlay 时报
  `ENOENT: no such file or directory, open '<profile>/node_modules/dsh-user-addons/cordis.patch.yml'`，
  `dsh web` 直接起不来（Windows / Node v24 复现）。
- 源安装路径已验证：`npm pack` 产出的 tarball 现含 `cordis.patch.yml`（62 B），共 7 个文件。
- 临时解法（暂不能升级时）：手动把 `cordis.patch.yml` 放进
  `<profile>/node_modules/dsh-user-addons/`（Windows 为 `%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-user-addons\`），再重启 `dsh web`。

## 为什么只改版本号
- 1.2.0 的包内容虽已修复，但版本号未变 —— 已安装 1.2.0 的用户不会收到更新提示，
  修复送不到他们手上。本版仅提升版本号让市场能识别并下发修复，功能无变更。

## 推送与回滚
- https://github.com/Yur0918/dsh-user-addons （v1.2.1 标签）
- 回滚：`git checkout v1.2.0 -- lib package.json`
