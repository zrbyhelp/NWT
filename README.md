# 新世界小说

新世界小说是 AI 驱动的新体系交互式小说体验。项目优先面向中文用户，默认语言为 `zh-CN`，英文 `en-US` 作为辅助语言。

## 快速启动

```bash
pnpm install
pnpm prisma:migrate
pnpm prisma:generate
pnpm dev
```

`pnpm dev` 会同时启动：

- 应用：`http://localhost:3000`
- 文档：`http://localhost:5173`

只启动单项服务：

```bash
pnpm run dev:app
pnpm run dev:docs
```

## 文档

完整说明见 `docs/`：

- 快速开始：`docs/guide/getting-started.md`
- 首页工作台：`docs/guide/workspace.md`
- AI 配置：`docs/guide/ai-settings.md`
- 环境变量：`docs/guide/environment.md`
- 架构说明：`docs/guide/architecture.md`
- 开发命令：`docs/guide/development.md`

如果这个项目对你有帮助，欢迎去 GitHub 点点 Star：`https://github.com/zrbyhelp/NWT.git`

## License

MIT License，详见 `LICENSE`。
