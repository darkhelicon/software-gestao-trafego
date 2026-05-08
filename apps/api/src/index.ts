import { buildApp } from "./app.js";

const PORT = Number(process.env["PORT"] ?? 3001);
const HOST = process.env["NODE_ENV"] === "production" ? "0.0.0.0" : "127.0.0.1";

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`API listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
