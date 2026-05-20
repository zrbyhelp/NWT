import { spawn, spawnSync } from "node:child_process";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const processes = [];
let shuttingDown = false;

processes.push(start("应用", ["run", "dev:app"]));
processes.push(start("文档", ["run", "dev:docs"]));

function start(label, args) {
  const child = spawn(pnpmCommand, args, {
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    stopAll();

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error(`[${label}] 启动失败：${error.message}`);
    shuttingDown = true;
    stopAll();
    process.exit(1);
  });

  return child;
}

function stopAll() {
  for (const child of processes) {
    if (child.killed) {
      continue;
    }

    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      child.kill();
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    stopAll();
    process.exit(0);
  });
}
