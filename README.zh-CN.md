# Light Markdown Editor

[English](README.md) | [中文](README.zh-CN.md)

一款受 Typora 启发的轻量级跨平台 Markdown 桌面编辑器。

Light Markdown Editor 聚焦安静、应用优先的写作体验。它定位为简单的桌面编辑器而非 IDE，提供原生文件操作、实时预览和紧凑的文档工作流。项目目标是聚焦 Markdown 写作本身，而不是 workspace 或项目管理，并持续面向 macOS、Linux、Windows 三平台兼容。

## 特性

- Markdown 编辑与实时渲染预览。
- `Write`、`Split`、`Read` 三种视图模式。
- 原生桌面 `Open`、`Save`、`Save As...`。
- 原生导出能力：`Export HTML...` 与 `Export PDF...`。
- 多文档会话与打开文档抽屉。
- 多草稿持久化与应用重启后的会话恢复。
- 明亮 / 暗黑主题。
- 按比例文档缩放。
- 工具栏 `Insert`，用于块级 Markdown 结构快速插入。
- KaTeX 数学公式渲染，支持行内公式（`$...$`）与块级公式（`$$...$$`）。
- 内置 `Find / Replace` 面板，支持 `区分大小写（Aa）` 与 `全词匹配（""）` 开关。
- 面向键盘的查找工作流（`Cmd/Ctrl+F` 查找，`Cmd/Ctrl+R` 替换面板开关）。
- 自动完成提示与可配置触发组合键。
- `File > Open Recent` 最近文件历史（真实文件名 + 路径，最多 10 条）。
- 格式化工具按钮（`Bold`、`Italic`、`Link`、`Code`、`Quote`）以及原生 `Formatting` 菜单支持。
- 支持图片粘贴 / 拖入：图片会写入当前文档作用域目录 `assets/<文档名>/`，并自动插入 Markdown 图片链接。
- 粘贴为 Markdown：当剪贴板包含 HTML 内容（从网页或富文本应用复制）时，粘贴会自动转换为 Markdown，同时保留系统原生粘贴快捷键体验。
- HTML 导出会内嵌本地图片，导出的单文件可离线直接查看。
- 标准 PDF 导出，包含面向长文档的块级分页优化。
- KaTeX 公式会在预览与导出中渲染；导出文档内嵌公式布局样式，应用内预览使用打包内置的 KaTeX 字体。
- `File > Clean Unused Assets...`：仅扫描当前文档作用域资源，将未引用图片安全移动到回收站（非物理删除）。
- `File > Download Remote Images...`：将当前文档中的 `http(s)` 远程图片下载到作用域资源目录，并把链接改写为本地路径（从而能在编辑器图片 CSP 下正常显示）；下载失败的会跳过并汇总提示。
- 原生菜单自定义项支持跟随应用语言切换（`English`、`中文`、`日本語`）。
- 设置面板支持主题、缩放与自动完成快捷键偏好设置。
- 内置界面语言切换（`English`、`中文`、`日本語`），可在设置中调整。
- 原生文件对话框与桌面快捷键。
- 按操作系统适配的快捷键展示与可选项过滤。
- 严格 CSP、文件 IO 限制与受净化的预览流水线。

## 技术栈

- Tauri v2（桌面应用壳层）
- TypeScript + Vite（编辑器 UI）
- Rust（原生命令与文件操作）
- `marked`（Markdown 渲染）
- `KaTeX`（数学公式渲染）
- `highlight.js`（代码块语法高亮）
- `turndown`（含 GFM 插件，将粘贴的 HTML 转换为 Markdown）
- `html2canvas` + `jsPDF`（PDF 导出）
- `DOMPurify`（预览内容净化）
- Vitest（对抽离出的纯函数模块做单元测试）
- ESLint + Prettier（代码风格统一）
- TypeScript `strict` 模式，并启用 `noUnusedLocals`、`noUnusedParameters`、`exactOptionalPropertyTypes`

## 项目结构

- `src/main.ts` —— 应用入口与顶层装配。
- `src/core/` —— 文件工作流控制器，包括打开、保存、导出与资源管理。
- `src/ui/` —— UI 控制器，包括自动完成、查找、插入菜单、大纲与设置。
- `src/editor/` —— 编辑器纯函数（snippets、find matches、列表 / 代码块续行），含单元测试。
- `src/utils/` —— 通用工具（`html`、`path`、`platform`、`storage`）。
- `src/storage/` —— 会话持久化与最近文件同步。
- `src/i18n/` —— 翻译字典与查找辅助函数。
- `src/types.ts` / `src/constants.ts` —— 共享的类型别名与常量。
- `src-tauri/` —— Rust 端命令、Tauri 配置与原生菜单接线。

## 安全

- 在 `tauri.conf.json` 中启用严格 Content Security Policy（`default-src 'self'`、无远程脚本、`object-src 'none'`、`frame-ancestors 'none'`）。
- Tauri 文件 IO 拒绝 `.md`、`.markdown`、`.txt` 之外的扩展名，并在读写两端拒绝符号链接 / 非普通文件。
- 预览 HTML 经 `DOMPurify` 净化，属性与文本转义补齐对 `'` 与 `>` 的覆盖。

## 本地运行

```bash
npm install
npm run tauri:dev
```

## 常用脚本

| Script | 用途 |
| --- | --- |
| `npm run dev` | Vite 浏览器端开发服务 |
| `npm run tauri:dev` | Tauri 桌面端开发壳 |
| `npm run build` | 先 `tsc` 类型检查，再 `vite build` |
| `npm run test` / `test:watch` / `test:coverage` | Vitest 单次运行 / 监听 / 覆盖率 |
| `npm run lint` / `lint:fix` | 对 `src` 运行 ESLint |
| `npm run format` / `format:check` | Prettier 写入 / 检查 |
| `npm run check` | 提 PR 前的一站式：build + test + lint + `cargo check` |

## 参与贡献

欢迎参与贡献。请参考 [CONTRIBUTING.md](CONTRIBUTING.md) 了解本地搭建、开发原则与 Pull Request 指南。

## 项目状态

项目目前处于 alpha 阶段。已具备基础 Markdown 编辑工作流，但仍在持续迭代中，暂未定位为稳定正式版。

## 发布流程

- 打包 CI 仅面向发布流程触发。
- macOS 构建工作流仅在 `release` 分支提交和 `v*` tag 推送时触发（常规 `master` 提交不触发）。
- tag 触发构建时，应用 About 版本会与 tag 版本自动同步。

## 许可证

Copyright (c) 2026 Renbin.Cai

本项目采用双许可证模式：

- 开源：GNU General Public License v3.0 or later，见 [LICENSE](LICENSE)。
- 商业授权：见 [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)。
