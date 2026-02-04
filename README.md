# AIChat_platform

一个基于 React + Vite + TypeScript 的本地聊天平台示例，包含前端（UI/UX 优化、Ant Design）和后端（SSE 实时返回、分片上传）两部分。

目标：提供一个可本地运行的智能客服/聊天演示工程，支持多会话、暗色主题、文件分片上传与流式 AI 回复。

---

## 主要特性

- 前端：React + Vite + TypeScript，使用 Ant Design 组件做布局与 UI。
- 状态管理：Zustand（`chatStore`、`sessionStore`、`fileStore`、`themeStore`）。
- 实时回复：后端通过 SSE 向前端推送流式回复，前端支持中断与超时处理。
- 多会话支持：每个会话独立存储与切换，历史可持久化。
- 文件上传：支持分片上传、合并与解析（在 `ai-backend` 中实现）。
- 主题系统：使用 CSS 变量与 `html.dark` 实现深色/浅色主题统一切换。

---

## 仓库结构（简要）

- `ai-backend/`：后端服务，含 SSE 聊天接口与上传实现。
- `public/`：静态资源。
- `src/`：前端源码。
  - `components/`：UI 组件（`ChatInput`、`ChatMessage`、`Sidebar` 等）。
  - `pages/`：路由页面（`chat/`、`history/`、`setting/`、`MainLayout.tsx`）。
  - `store/`：Zustand 状态管理（聊天、会话、主题、文件）。
  - `services/`：文件上传等客户端服务。
  - `utils/`：工具函数（如 `md5.ts`）。

---

## 环境要求

- Node.js >= 16（建议 18+）
- npm 或 pnpm

---

## 快速开始（本地开发）

1. 克隆仓库并安装依赖：

```bash
git clone <repo-url>
cd ai-chat-platform
npm install
```

2. 启动后端（在新终端）：

```bash
cd ai-backend
# 在运行前设置必要的环境变量（示例）
# macOS / Linux
export DASHSCOPE_API_KEY="your_dashscope_api_key"
# Windows PowerShell 示例：
$env:DASHSCOPE_API_KEY = "your_dashscope_api_key"
npm install
npm run dev
```

3. 启动前端：

```bash
# 回到项目根目录
cd ..
npm run dev
```

前端默认会请求 `http://localhost:3001/api/ai-chat`（可在后端配置中修改）。

---

## 常用脚本

- `npm run dev`：启动前端开发服务器（Vite）。
- 在 `ai-backend/` 中：`npm run dev` 启动后端（Express + SSE）。
- `npm run build`：构建前端静态文件。

---

## 重要环境变量

- `DASHSCOPE_API_KEY`：用于后端调用模型或第三方服务的 API Key（示例名，根据后端实现而定）。
- `PORT`：后端监听端口（默认 3001）。

将上述变量按运行环境设置在 shell 或 `.env` 文件中（后端会读取）。

---

## 调试与排查建议

- 若前端无法接收到模型回复：确认后端服务已启动并能访问模型 API，检查后端日志中的 SSE 请求与错误堆栈。
- 若出现永远“正在输入...”的气泡：前端会在 `messages` 中插入占位的 `assistant`（`status=loading`），若后端没有发送任何片段或发生错误，前端会在超时/错误处置里把该消息标记为完成或移除，请检查后端是否返回 `[DONE]` 或发生异常。
- 文件上传失败：检查 `ai-backend` 中的分片合并逻辑以及前端的 `fileUploadService.ts` 是否正确计算 `md5`。

---

## 贡献与开发建议

- 若要扩展模型适配器，请在 `ai-backend` 中抽象出调用模型的层，并确保 SSE 兼容流式返回。
- UI 优化：消息列表可使用虚拟化（如 `react-window`）来提升大量历史消息场景下的渲染性能。

---

## 许可证

本仓库按仓库维护者意愿开源或私有管理（请在此处补充许可证信息）。

---

如果你希望我把 README 翻译成英文，或加入更详细的 API 文档（例如 `/api/ai-chat` 的请求/响应格式），告诉我我会继续补充。
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
