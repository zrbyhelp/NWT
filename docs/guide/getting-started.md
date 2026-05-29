# 快速开始

本页用于从空环境启动栖境AI。本地开发时，`pnpm dev` 会同时启动 Next.js 应用和 VitePress 文档站点。

## 版本要求

- Node.js：`>=22 <23`
- pnpm：`>=10`
- MySQL：用于 Prisma 数据库
- 可选依赖：Redis、Qdrant、Neo4j、Cloudflare R2、Langfuse

## 安装依赖

```bash
pnpm install
```

## 配置环境变量

复制 `.env.example` 为 `.env.local`，至少配置：

```bash
DATABASE_URL="mysql://..."
REDIS_URL="redis://..."
QDRANT_URL="http://localhost:6333"
NEO4J_URI="bolt://localhost:7687"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="password"
AI_CONFIG_ENCRYPTION_KEY="至少 16 位的随机字符串"
```

如果需要没有用户上下文的内部 LLM 兜底配置，还可以补充：

```bash
OPENAI_BASE_URL="https://api.example.com/v1"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="..."
```

首页登录用户聊天不会使用这组 `.env` 兜底配置。用户可在右上角“设置”中配置个人 AI 供应商和默认 LLM 模型；如果管理员已经配置通用默认 LLM，新用户无需个人配置也可以直接聊天。

真实 AI 访问必须接入 Langfuse 观测。若使用本地 Langfuse Docker，请把 `.env.langfuse.local` 中初始化项目的 key 同步到 `.env.local`：

```bash
LANGFUSE_PUBLIC_KEY="lf_pk_..."
LANGFUSE_SECRET_KEY="lf_sk_..."
LANGFUSE_BASE_URL="http://localhost:3001"
```

旧变量名 `LANGFUSE_BASEURL` 仍可兼容读取，但新配置统一使用 `LANGFUSE_BASE_URL`。

管理员账号使用：

```bash
ADMIN_ACCOUNT="root"
ADMIN_PASSWORD="至少 6 位"
```

## 启动数据库并迁移

只启动 MySQL：

```bash
docker compose up -d mysql
pnpm prisma:migrate
pnpm prisma:generate
```

如果后续新增功能包含 Prisma schema 变更，开发完成后应同步新增迁移并执行 `pnpm prisma:migrate`。

## 启动项目和文档

```bash
pnpm dev
```

该命令会同时运行：

- `pnpm run dev:app`：Next.js 应用，默认 `http://localhost:3000`
- `pnpm run dev:docs`：VitePress 文档，默认 `http://localhost:5173`

如果只想启动其中一个服务：

```bash
pnpm run dev:app
pnpm run dev:docs
```

## 首次使用流程

1. 打开 `http://localhost:3000/zh-CN`。
2. 浏览首页、社区剧本或社区素材不需要登录。
3. 创建会话、发送消息、加入社区素材或保存设置时会要求登录。
4. 进入右上角“设置”，可配置个人 AI 供应商和默认 LLM 模型；若管理员已配置通用默认 LLM，可先直接开始聊天。
5. 后续可继续配置向量模型、图片模型和语音模型，供记忆检索、图片生成与语音能力使用。
