import { spawn } from "node:child_process";
const server = spawn(process.execPath, ["--watch", "server/index.mjs"], {
  stdio: "inherit",
  env: { ...process.env, APP_ORIGIN: "http://localhost:5173" },
});
const frontend = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
  { stdio: "inherit" },
);
function stop() {
  server.kill();
  frontend.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", stop);
frontend.on("exit", stop);
