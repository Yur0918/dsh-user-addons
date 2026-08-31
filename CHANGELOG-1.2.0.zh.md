# dsh-user-addons 1.2.0 变更说明

## UI 设计专家（32 处视觉层优化）
- 间距归一 4px 网格、圆角三档体系（6/10/14）
- 交互蓝收敛至主操作/选中态；文字色阶走 DSW 别名变量
- 全部可交互元素补 :focus-visible 轮廓；禁用态统一
- 深色模式硬编码浅色值补变量包裹

## 推送与回滚
- https://github.com/Yur0918/dsh-user-addons （v1.2.0 标签，含 dsh.bundle manifest）
- 回滚：`git checkout v-baseline-0831 -- lib/client.js package.json`
