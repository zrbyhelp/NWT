# Docker 服务

`docker-compose.yml` 包含应用本地依赖服务：

- MySQL
- Redis
- Qdrant
- Neo4j

`docker-compose.langfuse.yml` 单独提供 Langfuse v3 本地栈，包含 Langfuse web/worker、Postgres、ClickHouse、MinIO 和 Langfuse 自用 Redis。Langfuse 镜像默认使用 GHCR：`ghcr.io/langfuse/langfuse:latest` 与 `ghcr.io/langfuse/langfuse-worker:latest`，避免 Docker Hub 拉取不稳定时阻塞本地启动。

## 启动全套本地服务

Langfuse 使用 `.env.langfuse.local` 提供本地密钥、初始账号和项目 API key。该文件只保存在本地，不提交 Git；可参考 `.env.langfuse.example` 重新生成。

```bash
docker compose --env-file .env.langfuse.local -f docker-compose.yml -f docker-compose.langfuse.yml up -d
```

## 常用地址

- Langfuse UI：`http://localhost:3001`
- MinIO API：`http://localhost:9090`
- MinIO Console：`http://localhost:9091`
- Neo4j Browser：`http://localhost:7474`
- Qdrant：`http://localhost:6333`

## 首页工作台数据库

首页消息工作台依赖 MySQL 持久化剧本、会话、消息、AI 供应商、LLM 模型和向量模型。首次使用前需要先启动 MySQL，并执行 Prisma 迁移：

```bash
docker compose up -d mysql
pnpm prisma:migrate
```

如果 MySQL 未启动或迁移未执行，首页会以只读方式展示默认“基础 AI 剧本”，但不能创建消息、发送聊天或保存 AI 模型配置。

Langfuse 初始用户邮箱为 `q19946502@gmail.com`，密码保存在本地 `.env.langfuse.local` 的 `LANGFUSE_INIT_USER_PASSWORD`。

AI 不自动运行 Next.js 项目；Docker 服务只有在用户明确要求时才启动。
