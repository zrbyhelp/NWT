import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "docs/.vitepress/cache/**",
      "docs/.vitepress/dist/**"
    ]
  },
  ...nextVitals
];

export default eslintConfig;
