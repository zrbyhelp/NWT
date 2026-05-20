# 环境变量

环境变量模板在 `.env.example`。项目使用 `@t3-oss/env-nextjs` 与 `zod` 做配置校验。

## 核心配置

- `DATABASE_URL`：MySQL 连接地址。
- `REDIS_URL`：BullMQ 使用的 Redis 连接地址。
- `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL`：OpenAI-compatible 兼容回退配置。当数据库中没有启用的默认 LLM 模型时使用。
- `AI_CONFIG_ENCRYPTION_KEY`：AI 供应商 API Key 的加密密钥。保存或读取设置弹窗中的供应商密钥时必须配置，建议使用足够长的随机字符串。
- `QDRANT_URL`：Qdrant 地址。
- `NEO4J_URI`、`NEO4J_USERNAME`、`NEO4J_PASSWORD`：Neo4j 配置。
- `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME`：Cloudflare R2 配置。
- `LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY`、`LANGFUSE_BASEURL`：Langfuse 观测配置。

## Langfuse 本地配置

Langfuse Docker 使用 `.env.langfuse.local`，模板为 `.env.langfuse.example`。真实本地密钥不提交 Git，包含：

- `LANGFUSE_NEXTAUTH_SECRET`、`LANGFUSE_SALT`、`LANGFUSE_ENCRYPTION_KEY`：Langfuse 运行密钥。
- `LANGFUSE_POSTGRES_PASSWORD`、`LANGFUSE_CLICKHOUSE_PASSWORD`、`LANGFUSE_REDIS_AUTH`：Langfuse 内部依赖服务密码。Compose 会由 ClickHouse 用户名和密码派生 `CLICKHOUSE_MIGRATION_URL`。
- `LANGFUSE_MINIO_ROOT_USER`、`LANGFUSE_MINIO_ROOT_PASSWORD`、`LANGFUSE_S3_BUCKET`：Langfuse 本地对象存储配置。
- `LANGFUSE_INIT_*`：初始化组织、项目、用户和项目 API key。

主应用本地 `.env.local` 中的 `LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY` 应与 `.env.langfuse.local` 中的初始化项目 key 保持一致。

## AI 模型配置

首页右上角“体验设置”提供 AI 供应商、LLM 模型和向量模型管理。供应商按 OpenAI-compatible 协议保存 `baseUrl` 与加密后的 API Key；LLM 模型和向量模型分别只能有一个启用且供应商可用的默认项。

API Key 不会在前端明文展示，编辑供应商时只能重填或清空。若需要让数据库配置接管真实聊天回复，请先执行最新 Prisma 迁移，并配置 `AI_CONFIG_ENCRYPTION_KEY`。
