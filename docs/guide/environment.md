# 环境变量

环境变量模板在 `.env.example`。项目使用 `@t3-oss/env-nextjs` 与 `zod` 做配置校验。

## 核心配置

- `DATABASE_URL`：MySQL 连接地址。
- `REDIS_URL`：BullMQ 使用的 Redis 连接地址。
- `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL`：OpenAI-compatible 兼容回退配置，仅用于没有用户上下文的内部调用。首页登录用户聊天优先使用当前账号个人默认 LLM，没有个人默认时使用管理员通用默认 LLM。
- `AI_CONFIG_ENCRYPTION_KEY`：AI 供应商 API Key 的加密密钥。保存或读取设置弹窗中的供应商密钥时必须配置，建议使用足够长的随机字符串。
- `ADMIN_ACCOUNT`、`ADMIN_PASSWORD`：管理员账号和密码。管理员身份只由当前登录账号是否等于 `ADMIN_ACCOUNT` 判断；`ADMIN_PASSWORD` 用于确保该账号可登录。未配置时普通注册和登录仍可使用，但设置中不会出现“管理员”分类。
- `ADMIN_ACCOUNTS`、`ADMIN_EMAILS`：统一登录补充管理员匹配列表，逗号分隔。任一账号或邮箱命中都视为管理员。
- `PORTAL_BASE_URL`、`SERVICE_CLIENT_ID`、`SERVICE_CLIENT_SECRET`、`NEXT_PUBLIC_APP_URL`：统一登录服务配置。`PORTAL_BASE_URL` 指向统一登录门户，`SERVICE_CLIENT_ID` 和 `SERVICE_CLIENT_SECRET` 用于本项目与统一登录服务交换令牌，`NEXT_PUBLIC_APP_URL` 用于回调地址拼接。
- `FEEDBACK_SERVICE_SLUG`：统一门户投诉建议中心使用的服务标识，默认 `qijing-ai`。头像菜单中的“投诉建议”会把这个 slug、当前页面地址和当前登录用户 slug 一起带到统一门户。
- `QDRANT_URL`：Qdrant 地址。
- `NEO4J_URI`、`NEO4J_USERNAME`、`NEO4J_PASSWORD`：Neo4j 配置。
- `R2_ACCOUNT_ID`、`R2_ENDPOINT`、`R2_PUBLIC_BASE_URL`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME`：Cloudflare R2 配置。`R2_ENDPOINT` 可省略，省略时会由 `R2_ACCOUNT_ID` 自动拼接默认 R2 endpoint；`R2_PUBLIC_BASE_URL` 可选，用于头像上传后的公开访问地址。未配置时，应用会使用 `/api/storage/r2/[key]` 代理读取 R2 私有对象。
- `LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY`、`LANGFUSE_BASE_URL`：Langfuse 观测配置。旧变量名 `LANGFUSE_BASEURL` 仍作为兼容别名保留。

## Langfuse 本地配置

Langfuse Docker 使用 `.env.langfuse.local`，模板为 `.env.langfuse.example`。真实本地密钥不提交 Git，包含：

- `LANGFUSE_NEXTAUTH_SECRET`、`LANGFUSE_SALT`、`LANGFUSE_ENCRYPTION_KEY`：Langfuse 运行密钥。
- `LANGFUSE_POSTGRES_PASSWORD`、`LANGFUSE_CLICKHOUSE_PASSWORD`、`LANGFUSE_REDIS_AUTH`：Langfuse 内部依赖服务密码。Compose 会由 ClickHouse 用户名和密码派生 `CLICKHOUSE_MIGRATION_URL`。
- `LANGFUSE_MINIO_ROOT_USER`、`LANGFUSE_MINIO_ROOT_PASSWORD`、`LANGFUSE_S3_BUCKET`：Langfuse 本地对象存储配置。
- `LANGFUSE_INIT_*`：初始化组织、项目、用户和项目 API key。

主应用本地 `.env.local` 中的 `LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY` 应与 `.env.langfuse.local` 中的 `LANGFUSE_INIT_PROJECT_PUBLIC_KEY`、`LANGFUSE_INIT_PROJECT_SECRET_KEY` 保持一致，并配置 `LANGFUSE_BASE_URL="http://localhost:3001"`。非测试环境中，聊天、假面 AI 辅助、图片生成和供应商 `/models` 拉取都会要求 Langfuse key 已配置，避免真实 AI 调用脱离观测。

## Langfuse AI 观测

服务端通过 `src/instrumentation.ts` 注册 Langfuse OpenTelemetry span processor。OpenAI-compatible 文本调用使用 `@langfuse/openai` 包装，LangChain/LangGraph 工作流使用 `@langfuse/langchain` callback，图片生成和供应商模型列表拉取使用统一业务 span 手动记录。

当前记录范围：

- 聊天流式与非流式回复：完整 prompts、回复文本、模型、供应商、token、用户和会话 ID。
- 假面 AI 辅助：完整结构化输入与输出。
- 图片生成：记录 prompt、模型、尺寸、状态和输出文件元数据，不记录 base64 图片正文。
- 供应商 `/models` 拉取：记录供应商、Base URL、状态和返回模型数量。

## AI 模型配置

首页右上角“设置”提供 AI 供应商、LLM 模型、向量模型、图片模型和语音模型管理。供应商按当前登录账号隔离，并按 OpenAI-compatible 协议保存 `baseUrl` 与加密后的 API Key；LLM、向量、图片和语音模型分别只能有一个启用且供应商可用的个人默认项，模型列表可通过快捷默认图标直接切换默认项。管理员还可把 LLM、向量、图片和语音模型设为通用，通用模型使用管理员供应商与 API Key，普通用户可见但只读；默认调用先使用当前账号个人默认，没有个人默认时使用管理员通用默认。新增或编辑模型时，前端会根据所选供应商调用服务端动作，由服务端使用当前账号已保存的 API Key 请求 `{baseUrl}/models` 拉取模型列表；若供应商不支持该接口或请求失败，仍可手动输入模型 ID。LLM 上下文窗口不在配置表单中暴露，调用时遵循模型和供应商默认策略。

API Key 不会在前端明文展示，编辑供应商时只能重填或清空。若需要让数据库配置接管真实聊天回复，请先执行最新 Prisma 迁移，并配置 `AI_CONFIG_ENCRYPTION_KEY`。AI 配置用户化迁移会把已有全局供应商和模型转移到账号 `q19946502`；如果该账号尚未设置密码，使用注册入口注册同名账号即可接管这些配置。

## 开发服务

`pnpm dev` 会同时启动应用和 VitePress 文档：

- 应用：`http://localhost:3000`
- 文档：`http://localhost:5173`

只需要单独启动时，可使用 `pnpm run dev:app` 或 `pnpm run dev:docs`。

## 登录与权限

首页、剧本浏览、社区剧本浏览和社区素材浏览不要求登录。创建会话、发送消息、删除会话、加入社区素材、管理 AI 设置、上传头像和访问“我的剧本”需要普通账号登录；全局代理等管理员设置需要当前登录账号匹配 `ADMIN_ACCOUNT`。项目不再提供独立 `/admin` 后台路由。登录与注册已改为统一登录跳转，本项目不再收集本地账号密码，登录页与设置页只提供统一登录入口。
