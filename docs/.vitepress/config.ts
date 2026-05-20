import { defineConfig } from "vitepress";

export default defineConfig({
  title: "新世界小说",
  description: "AI 驱动的新体系交互式小说体验",
  lang: "zh-CN",
  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "架构", link: "/guide/architecture" },
      { text: "环境变量", link: "/guide/environment" }
    ],
    sidebar: [
      {
        text: "指南",
        items: [
          { text: "项目介绍", link: "/" },
          { text: "架构说明", link: "/guide/architecture" },
          { text: "环境变量", link: "/guide/environment" },
          { text: "Docker 服务", link: "/guide/docker" },
          { text: "主题与排版", link: "/guide/theme" }
        ]
      }
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/zrbyhelp/NWT" }]
  }
});

