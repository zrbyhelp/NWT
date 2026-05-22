# 新世界小说

新世界小说是 AI 驱动的新体系交互式小说体验。它不是传统小说阅读器，阅读界面只是承载 AI 交互、剧情推进、剧本探索、世界观组织和内容生成的工作台。

## 项目速览

- 默认语言：中文 `zh-CN`，英文 `en-US` 为辅助语言。
- 应用框架：Next.js App Router、React、TypeScript。
- 文档站点：VitePress，随 `pnpm dev` 一起启动。
- 数据持久化：Prisma + MySQL。
- AI 配置：OpenAI-compatible 供应商，支持 LLM、向量模型和图片模型管理。
- 存储与后台能力：Cloudflare R2、Redis、Qdrant、Neo4j、Langfuse。

## 推荐阅读顺序

1. [快速开始](/guide/getting-started)：安装依赖、配置环境、启动应用和文档。
2. [首页工作台](/guide/workspace)：了解聊天、剧本库、登录和设置入口。
3. [AI 配置](/guide/ai-settings)：配置供应商、LLM、向量模型和图片模型。
4. [环境变量](/guide/environment)：查看 `.env.local` 和 Langfuse 相关配置。
5. [架构说明](/guide/architecture)：理解数据模型、权限边界和 AI 调用链路。
6. [开发命令](/guide/development)：测试、lint、Prisma 和文档命令。

## 当前体验边界

- 未登录可以浏览首页、社区剧本和说明文档。
- 创建会话、发送消息、删除会话、管理个人剧本库、保存设置、上传头像和管理 AI 配置需要登录。
- 管理员账号会在“体验设置”中看到单独的管理员分类，可配置全局出站代理。
- 图片模型本次先完成配置、启停和默认项管理，后续封面、场景图和角色图生成会读取默认图片模型。

## 常用地址

- 应用开发服务：`http://localhost:3000`
- 文档开发服务：`http://localhost:5173`
- GitHub 仓库：`https://github.com/zrbyhelp/NWT.git`

如果这个项目对你有帮助，欢迎去 GitHub 点点 Star，支持新世界小说继续打磨。
