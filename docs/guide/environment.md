# 环境变量

环境变量模板在 `.env.example`。项目使用 `@t3-oss/env-nextjs` 与 `zod` 做配置校验。

## 核心配置

- `DATABASE_URL`：MySQL 连接地址。
- `REDIS_URL`：BullMQ 使用的 Redis 连接地址。
- `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL`：OpenAI-compatible 兼容回退配置。当数据库中没有启用的默认 LLM 模型时使用。
- `AI_CONFIG_ENCRYPTION_KEY`：AI 供应商 API Key 的加密密钥。保存或读取设置弹窗中的供应商密钥时必须配置，建议使用足够长的随机字符串。
- `ADMIN_ACCOUNT`、`ADMIN_PASSWORD`：后台管理员账号和密码。配置后系统会自动确保该账号为管理员；未配置时普通注册和登录仍可使用，但没有可进入后台的管理员账号。
- `QDRANT_URL`：Qdrant 地址。
- `NEO4J_URI`、`NEO4J_USERNAME`、`NEO4J_PASSWORD`：Neo4j 配置。
- `R2_ACCOUNT_ID`、`R2_ENDPOINT`、`R2_PUBLIC_BASE_URL`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME`：Cloudflare R2 配置。`R2_ENDPOINT` 可省略，省略时会由 `R2_ACCOUNT_ID` 自动拼接默认 R2 endpoint；`R2_PUBLIC_BASE_URL` 可选，用于头像上传后的公开访问地址。未配置时，应用会使用 `/api/storage/r2/[key]` 代理读取 R2 私有对象。
- `LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY`、`LANGFUSE_BASEURL`：Langfuse 观测配置。

## Langfuse 本地配置

Langfuse Docker 使用 `.env.langfuse.local`，模板为 `.env.langfuse.example`。真实本地密钥不提交 Git，包含：

- `LANGFUSE_NEXTAUTH_SECRET`、`LANGFUSE_SALT`、`LANGFUSE_ENCRYPTION_KEY`：Langfuse 运行密钥。
- `LANGFUSE_POSTGRES_PASSWORD`、`LANGFUSE_CLICKHOUSE_PASSWORD`、`LANGFUSE_REDIS_AUTH`：Langfuse 内部依赖服务密码。Compose 会由 ClickHouse 用户名和密码派生 `CLICKHOUSE_MIGRATION_URL`。
- `LANGFUSE_MINIO_ROOT_USER`、`LANGFUSE_MINIO_ROOT_PASSWORD`、`LANGFUSE_S3_BUCKET`：Langfuse 本地对象存储配置。
- `LANGFUSE_INIT_*`：初始化组织、项目、用户和项目 API key。

主应用本地 `.env.local` 中的 `LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY` 应与 `.env.langfuse.local` 中的初始化项目 key 保持一致。

## AI 模型配置

首页右上角“体验设置”提供 AI 供应商、LLM 模型、向量模型和图片模型管理。供应商按当前登录账号隔离，并按 OpenAI-compatible 协议保存 `baseUrl` 与加密后的 API Key；LLM、向量和图片模型分别只能有一个启用且供应商可用的默认项，模型列表可通过快捷默认图标直接切换默认项。新增或编辑模型时，前端会根据所选供应商调用服务端动作，由服务端使用当前账号已保存的 API Key 请求 `{baseUrl}/models` 拉取模型列表；若供应商不支持该接口或请求失败，仍可手动输入模型 ID。LLM 上下文窗口不在配置表单中暴露，调用时遵循模型和供应商默认策略。

API Key 不会在前端明文展示，编辑供应商时只能重填或清空。若需要让数据库配置接管真实聊天回复，请先执行最新 Prisma 迁移，并配置 `AI_CONFIG_ENCRYPTION_KEY`。AI 配置用户化迁移会把已有全局供应商和模型转移到账号 `q19946502`；如果该账号尚未设置密码，使用注册入口注册同名账号即可接管这些配置。

## 开发服务

`pnpm dev` 会同时启动应用和 VitePress 文档：

- 应用：`http://localhost:3000`
- 文档：`http://localhost:5173`

只需要单独启动时，可使用 `pnpm run dev:app` 或 `pnpm run dev:docs`。

## 登录与权限

首页、剧本浏览和社区剧本浏览不要求登录。创建会话、发送消息、删除会话、管理 AI 设置、上传头像、修改密码和访问“我的剧本”需要普通账号登录；访问 `/zh-CN/admin` 与 `/en-US/admin` 需要管理员角色。第一版开放账号密码注册，不做邮箱验证、验证码或邀请码。
