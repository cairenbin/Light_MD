# Light Markdown Editor

[English](README.md) | [中文](README.zh-CN.md)

一款受 Typora 启发的轻量级跨平台 Markdown 桌面编辑器。

Light Markdown Editor 聚焦安静、应用优先的写作体验。它定位为简单的桌面编辑器而非 IDE，提供原生文件操作、实时预览和紧凑的文档工作流。项目目标是聚焦 Markdown 写作本身，而不是 workspace 或项目管理，并持续面向 macOS、Linux、Windows 三平台兼容。

## 特性

- Markdown 编辑与实时渲染预览。
- `Write`、`Split`、`Read` 三种视图模式。
- 原生桌面 `Open`、`Save`、`Save As...`。
- 多文档会话与打开文档抽屉。
- 多草稿持久化与应用重启后的会话恢复。
- 明亮 / 暗黑主题。
- 按比例文档缩放。
- 工具栏 `Insert`，用于块级 Markdown 结构快速插入。
- 自动完成提示与可配置触发组合键。
- 设置面板支持主题、缩放与自动完成快捷键偏好设置。
- 原生文件对话框与桌面快捷键。
- 按操作系统适配的快捷键展示与可选项过滤。

## 技术栈

- Tauri v2（桌面应用壳层）
- TypeScript + Vite（编辑器 UI）
- Rust（原生命令与文件操作）
- `marked`（Markdown 渲染）
- `DOMPurify`（预览内容净化）

## 本地运行

```bash
npm install
npm run tauri:dev
```

## 项目状态

项目目前处于 alpha 阶段。已具备基础 Markdown 编辑工作流，但仍在持续迭代中，暂未定位为稳定正式版。

## 许可证

本项目采用双许可证模式：

- 开源：GNU General Public License v3.0 or later，见 [LICENSE](LICENSE)。
- 商业授权：见 [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)。
