# Repository Guidelines

## 项目定位与语言要求

软件名称：新世界小说。作者：zr（中文名：臧浩然）。软件目标：打造 AI 驱动的新体系交互式小说体验。

联系方式：QQ `778241343`；电话/微信 `15043201648`；邮箱 `q19946502@gmail.com`。

本项目采用 MIT License 开源协议；完整协议文本以仓库根目录 `LICENSE` 文件为准。

本软件优先面向中国用户，界面文案、默认语言、主要文档均应使用中文。英文作为辅助语言保留，涉及国际化时必须支持中英文切换，例如 `zh-CN` 为默认语言，`en-US` 为可选语言。

新增用户可见文本时，应同时考虑中英文资源文件，不要把界面文案硬编码在业务逻辑中。术语、按钮、错误提示和空状态文案应优先符合中文用户习惯。

## 项目结构与模块组织

当前仓库尚未形成固定代码结构。添加代码时建议保持以下布局：

```text
src/        # 应用源码
tests/      # 自动化测试
assets/     # 图片、字体、静态资源
docs/       # 中文为主的详细文档，使用 VitePress 编写
scripts/    # 本地开发或维护脚本
```

除 `package.json`、`pyproject.toml`、`.gitignore` 等标准配置文件外，避免把实现文件直接放在仓库根目录。

每次开发完成后，必须同步更新相关说明文档与 `docs/` 下的 VitePress 文档。功能、配置、命令、环境变量、用户可见行为或架构约定发生变化时，文档必须随代码一起提交。

## 框架与技术记录

引入任何框架、运行时、构建工具或主要依赖时，必须在本文档或 `docs/` 中记录用途、版本范围和常用命令。例如：前端框架、UI 组件库、测试框架、状态管理、路由、国际化方案、打包工具等。

当前规划技术栈：

- pnpm：项目包管理器，依赖安装、脚本运行和文档示例均优先使用 `pnpm`。
- Next.js App Router、React、TypeScript：应用框架、界面开发与类型约束。
- VitePress：详细文档站点方案，文档以中文为主、英文为辅。
- Tailwind CSS、shadcn/ui：样式系统与基础 UI 组件。
- 自有主题运行时：浅色/深色模式与主题状态管理；不要在 React 组件树中渲染内联主题脚本，避免 hydration 警告。
- 多配色预设：使用偏 AI/世界观交互的固定色板，例如星图、矩阵、深空、晨雾；配色模式与日夜模式独立组合。
- 全应用排版设置：使用 CSS variables/Tailwind token 承载字体、字号、行高、间距、内容密度等设置，默认本地优先保存。
- next-intl：国际化方案，默认中文 `zh-CN`，支持英文 `en-US` 切换。
- 首页右上角必须提供后台入口和中英文切换下拉；语言切换保留当前路径结构。
- 后台路由为 `/zh-CN/admin` 与 `/en-US/admin`；第一版后台暂不鉴权，先提供仪表盘、交互线程、世界图谱、任务队列、系统设置等运营核心入口。
- zod、@t3-oss/env-nextjs、react-hook-form：schema 校验、环境变量校验与前端表单状态管理。
- date-fns：时间格式化，例如阅读记录、任务时间、日志时间。
- Intl.NumberFormat：数值格式化优先使用内置 API，不额外引入数值格式化库。
- sonner：Toast/通知提示。
- lucide-react：图标库，与 shadcn/ui 搭配使用。
- cmdk：命令菜单、快捷搜索、跳转与操作入口。
- Prisma、MySQL：关系型数据建模、迁移与持久化。
- Vercel AI SDK：仅负责前端流媒体对话相关能力，例如聊天 UI 的流式响应展示。
- LangGraph、LangChain、LangChain Splitter：AI 工作流编排、链式处理与文本切分。
- openai SDK、OpenAI-compatible：后端模型调用使用 `openai` SDK 或 LangChain 适配器；模型接口需兼容 OpenAI API 格式，便于切换兼容服务商。
- @qdrant/js-client-rest、Qdrant、neo4j-driver、Neo4j：向量检索与图数据存储。
- Sigma.js：图谱可视化。
- BullMQ、ioredis、Redis：AI 分析、向量化、图谱构建等后台异步任务队列。
- @aws-sdk/client-s3、Cloudflare R2：小说文件、封面、导入原文等对象存储，按 S3-compatible 方式接入。
- Langfuse：AI 调用观测、追踪与评估。
- Vitest、React Testing Library：单元测试与 React 组件测试；测试不包含打包测试。
- Docker Compose：本地依赖服务编排，例如 MySQL、Redis、Qdrant、Neo4j、Langfuse。
- Langfuse 本地 Docker 使用 `.env.langfuse.local` 提供密钥和初始化账号，该文件不提交 Git；模板为 `.env.langfuse.example`。启动全套依赖服务时使用 `docker compose --env-file .env.langfuse.local -f docker-compose.yml -f docker-compose.langfuse.yml up -d`。

仍需在项目落地时补充：Node.js 与 pnpm 版本、Next.js/React 主版本、Prisma 迁移策略、环境变量清单、Docker Compose 服务端口、Redis 连接配置、Cloudflare R2 bucket 与凭据配置、AI 模型提供商配置、国际化目录结构、VitePress 文档目录与导航、环境变量校验策略、主题默认值、色板 token、排版设置项清单、本地保存 key、是否跟随系统主题、`date-fns` locale、命令菜单快捷键策略。

## 构建、测试与开发命令

当前仓库尚未定义构建或测试命令。引入工具链后，在此记录稳定命令及用途：

```bash
pnpm install      # 安装依赖
pnpm test         # 运行测试，不包含打包测试
pnpm dev          # 启动本地开发服务，由用户自行执行
pnpm build        # 生产构建，仅在明确需要时运行
pnpm lint         # 运行静态检查
pnpm docs:dev     # 启动 VitePress 文档站点，由用户自行执行
pnpm docs:build   # 构建 VitePress 文档
```

项目由用户自行运行。AI 不自动启动项目、开发服务或生产服务；除非用户明确要求，只提供需要用户手动执行的命令。测试要求不包含打包测试；除非用户明确要求，不要把 `build` 作为默认测试步骤。

## 编码风格与命名规范

遵循所选语言和框架的社区规范。JSON、YAML、CSS、JavaScript、TypeScript 建议使用 2 空格缩进；Python 使用 4 空格缩进。文件命名保持同一技术栈内一致，例如 `user-service.ts`、`UserCard.tsx` 或 `test_user_service.py`。

首次加入格式化或 lint 工具时，应同步记录对应命令。

## 测试规范

测试文件放在 `tests/`，或在框架明确推荐时与源码同目录放置。测试命名应描述行为，例如 `user-service.test.ts` 或 `test_parse_input.py`。

新增功能应覆盖主要流程和边界情况；修复缺陷时尽量补充回归测试。默认只运行单元测试、集成测试或项目约定测试，不执行打包测试。

## 提交与 Pull Request 规范

Git 仓库地址：`https://github.com/zrbyhelp/NWT.git`。

每次提交应包含本次任务涉及的全部代码和文档变更，避免只提交部分文件导致功能不完整。开发完成后必须同步提交说明文档与 VitePress 文档更新。提交说明使用中文，简洁描述变更内容；如果一次提交包含多个功能修改，应在提交说明中逐项标注多个功能点。

提交说明示例：

```text
新增主题设置与排版配置

- 增加日夜模式配置
- 增加多配色预设说明
- 增加全应用排版设置约定
```

PR 应包含变更摘要、测试结果、关联问题；涉及界面时提供截图或录屏。面向用户的变更需说明中文文案和英文切换是否已覆盖。

## Agent-Specific Instructions

如果用户需求存在模糊点，必须先请求用户确认。保持修改范围聚焦，不引入与当前任务无关的目录、框架或依赖。AI 不自动运行项目；需要启动、预览或验证运行效果时，应说明命令并由用户自行执行。
