# 环境变量

环境变量模板在 `.env.example`。项目使用 `@t3-oss/env-nextjs` 与 `zod` 做配置校验。

## 核心配置

- `DATABASE_URL`：MySQL 连接地址。
- `REDIS_URL`：BullMQ 使用的 Redis 连接地址。
- `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL`：OpenAI-compatible 模型配置。
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
