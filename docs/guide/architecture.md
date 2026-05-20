# 架构说明

## 前端

前端使用 Next.js App Router、React、TypeScript、Tailwind CSS 与 shadcn/ui 风格组件。语言路由始终带前缀：`/zh-CN` 与 `/en-US`。

## AI 边界

Vercel AI SDK 仅负责前端流媒体对话展示。后端模型调用使用 `openai` SDK 或 LangChain 适配 OpenAI-compatible 服务。LangGraph、LangChain 与 LangChain Splitter 负责工作流编排、链式处理和文本切分。

## 数据与任务

MySQL 由 Prisma 管理。Qdrant 用于向量检索，Neo4j 用于世界观图谱，BullMQ + Redis 用于 AI 分析、向量化、图谱构建等后台任务。

