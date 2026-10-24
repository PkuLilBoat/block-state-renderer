<img src="assets/community-banner.png" alt="AI时代的学习和创作" width="680">

<table><tr><td width="180"><img src="assets/wechat.jpg" alt="微信交流二维码" width="156"></td><td>扫描二维码，加入终身学习者社群、交流群。<br>一起交流 AI、知识管理与效率工具。<br>公众号同名：湖畔的赛博格</td></tr></table>

---

# Block state renderer

[English](README.md) | 简体中文

在 Obsidian Live Preview 的可编辑嵌套列表中，为任务、产品决策和自定义标签状态着色。子块继承最近父级的状态，子级显式状态覆盖继承；原始 Markdown 和标签保持可编辑。

## 界面预览

任务和产品决策状态的实际效果：子项继承父级颜色，显式子状态覆盖父级。

![可编辑嵌套列表中的任务与产品决策状态渲染](assets/screenshots/state-rendering.png)

截图来自 Obsidian 1.14.4，使用 GitHub 0.1.0 发布版和隔离 TEST 库中的演示笔记。

## 快速开始

1. 安装插件，在 **Live Preview** 中打开 Markdown 笔记。
2. 在命令面板执行 **Block state renderer: Toggle state rendering for current file**。每个新文件的渲染默认关闭。
3. 在无序列表项中加入状态标签：

```markdown
- Plan the next release #task/in_progress
  - Write the usage guide
  - Finish the parser tests #task/done
- Choose a login approach #prd/open/decision
  - Phone verification is required #prd/confirmed
```

开关跟随文件，对显示该文件的所有窗格生效。阅读视图与源码模式保留原生外观；关闭当前文件渲染或禁用插件后，视觉效果移除。

## 支持的状态

| 命名空间 | 状态 |
| --- | --- |
| `#task/` | `backlog`、`todo`、`in_progress`、`in_review`、`blocked`、`done`、`cancel` |
| `#prd/` | `open/missing`、`open/research`、`open/decision`、`provisional`、`confirmed`、`obsolete` |

任务与产品决策分别继承状态。行内代码和围栏代码块中的标签不参与识别；冲突状态会标出供人工处理，插件不会自动推进状态。

## 设置与自定义颜色

- **Render current file**：开启或关闭当前文件效果。
- **Shared opacity**：以 10 为步长，在 0–100 之间调整所有块效果的不透明度。
- **Show tag containers**：恢复原生标签胶囊，默认关闭。
- **Custom tag colors**：添加、重命名、重新着色、停用或删除普通标签的精确匹配规则；匹配区分大小写。

也可以直接编辑库根目录的 `block-state-renderer.colors.json`：

```json
{
  "version": 1,
  "rules": [
    { "tag": "#area/research", "color": "#a78bfa", "enabled": true }
  ]
}
```

自定义颜色沿嵌套列表继承，子级显式颜色覆盖父级。单项含有多个不同自定义颜色时，标签仍会着色，但该项的自定义块渐变不显示；内置任务／产品决策状态的块效果优先。JSON 无效时保留上一组有效规则。

## 安装

需要 Obsidian **1.13.0 或更高版本**。初始版本通过 GitHub 提供，完成官方目录提交和审核后才会出现在社区插件列表中。

手动安装时，从[最新发布页](https://github.com/PkuLilBoat/block-state-renderer/releases/latest)下载 `main.js`、`manifest.json`、`styles.css`，放进 `<库>/.obsidian/plugins/block-state-renderer/`；如果配置目录不同，使用库内实际配置目录。重载 Obsidian 并启用 **Block state renderer**，建议先在测试库试用初始版本。

## 隐私与兼容性

插件不发送网络请求、不收集遥测、不需要账号。文件级开关和偏好保存在插件设置中，修改自定义规则时会写入库根目录的颜色规则 JSON，不会改写笔记 Markdown。可选微信交流入口与插件使用独立。

既有桌面 TEST 证据覆盖浅色／深色主题、文件切换、设置持久化、嵌套继承、自定义颜色及禁用／重载行为。移动设备、准确最低应用版本、第三方主题及大文档性能尚未完整测试；初始渐变设计可能随反馈调整。

## 交流与反馈

问题与建议欢迎通过 [GitHub Issues](https://github.com/PkuLilBoat/block-state-renderer/issues) 提交。扫码交流为可选入口，不影响插件使用。

## 开发

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

构建产物为 `main.js`、`manifest.json` 和 `styles.css`。依赖与构建命令保留在仓库内，不手工编辑生成的 `main.js`。

## 许可证与致谢

[0BSD](LICENSE)。构建和 ESLint 配置改编自官方 [Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin/tree/07ceb81d1fb3384af611ebf665a1ec42a7e5926d)（0BSD）。运行时渲染使用 Obsidian 公开的编辑器扩展 API 与 CodeMirror。
