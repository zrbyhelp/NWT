import { defineConfig } from "vitepress";

export default defineConfig({
  title: "新世界小说",
  description: "AI 驱动的新体系交互式小说体验",
  lang: "zh-CN",
  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "快速开始", link: "/guide/getting-started" },
      { text: "AI 配置", link: "/guide/ai-settings" },
      { text: "架构", link: "/guide/architecture" },
      { text: "开发命令", link: "/guide/development" }
    ],
    sidebar: [
      {
        text: "入门",
        items: [
          { text: "项目介绍", link: "/" },
          { text: "快速开始", link: "/guide/getting-started" },
          { text: "首页工作台", link: "/guide/workspace" },
          { text: "AI 配置", link: "/guide/ai-settings" }
        ]
      },
      {
        text: "配置与运行",
        items: [
          { text: "环境变量", link: "/guide/environment" },
          { text: "Docker 服务", link: "/guide/docker" },
          { text: "开发命令", link: "/guide/development" }
        ]
      },
      {
        text: "设计与架构",
        items: [
          { text: "架构说明", link: "/guide/architecture" },
          { text: "主题与排版", link: "/guide/theme" }
        ]
      }
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/zrbyhelp/NWT" }]
  }
});
