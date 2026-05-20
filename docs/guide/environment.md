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

