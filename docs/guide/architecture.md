# 架构说明

## 前端

前端使用 Next.js App Router、React、TypeScript、Tailwind CSS 与 shadcn/ui 风格组件。语言路由始终带前缀：`/zh-CN` 与 `/en-US`。

首页右上角提供后台入口和语言切换下拉。语言切换保留当前路径结构，例如 `/zh-CN/admin` 切换为 `/en-US/admin`。

## 后台框架

后台路由为 `/zh-CN/admin` 与 `/en-US/admin`。第一版后台暂不做鉴权，先提供运营核心框架：仪表盘、交互线程、世界图谱、任务队列、系统设置。

## AI 边界

Vercel AI SDK 仅负责前端流媒体对话展示。后端模型调用使用 `openai` SDK 或 LangChain 适配 OpenAI-compatible 服务。LangGraph、LangChain 与 LangChain Splitter 负责工作流编排、链式处理和文本切分。

## 数据与任务

MySQL 由 Prisma 管理。Qdrant 用于向量检索，Neo4j 用于世界观图谱，BullMQ + Redis 用于 AI 分析、向量化、图谱构建等后台任务。
