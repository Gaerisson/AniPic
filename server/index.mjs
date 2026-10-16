import { createApp } from "./app.mjs";
const app = await createApp({
  logger: {
    level: "info",
    redact: [
      "req.headers.cookie",
      "req.headers.authorization",
      "req.body.password",
      "req.body.current",
    ],
  },
});
await app.listen({ port: app.anipicConfig.port, host: app.anipicConfig.host });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
