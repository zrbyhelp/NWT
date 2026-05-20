# Docker 服务

`docker-compose.yml` 包含应用本地依赖服务：

- MySQL
- Redis
- Qdrant
- Neo4j

`docker-compose.langfuse.yml` 单独提供 Langfuse v3 本地栈，包含 Langfuse web/worker、Postgres、ClickHouse、MinIO 和 Langfuse 自用 Redis。

AI 不自动运行项目或 Docker 服务。如需启动，由用户自行执行：

```bash
docker compose up -d
docker compose -f docker-compose.langfuse.yml up -d
```

