# 开发命令

项目使用 pnpm 作为包管理器。默认开发命令会同步启动应用与文档。

## 开发服务

```bash
pnpm dev
```

等价于同时运行：

```bash
pnpm run dev:app
pnpm run dev:docs
```

默认地址：

- 应用：`http://localhost:3000`
- 文档：`http://localhost:5173`

只启动应用：

```bash
pnpm run dev:app
```

只启动文档：

```bash
pnpm run dev:docs
```

## 测试与静态检查

```bash
pnpm test
pnpm lint
```

默认测试不包含生产构建。除非明确需要，不把 `pnpm build` 作为常规验证步骤。

## Prisma

```bash
pnpm prisma:migrate
pnpm prisma:generate
pnpm db:studio
```

新增或修改数据模型时，应同步新增迁移并执行：

```bash
pnpm prisma:migrate
pnpm prisma:generate
```

## 文档构建

```bash
pnpm docs:build
pnpm docs:preview
```

文档源码位于 `docs/`，VitePress 配置位于 `docs/.vitepress/config.mts`。新增功能、配置项、环境变量、命令或用户可见行为时，需要同步更新相关文档。
