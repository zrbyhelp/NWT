import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "mysql://nwt:nwt_password@localhost:3306/nwt"
  }
});
