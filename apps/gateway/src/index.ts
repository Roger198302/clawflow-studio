import Fastify, { type FastifyInstance } from "fastify";
import { pathToFileURL } from "node:url";

const DEFAULT_PORT = 8787;
const VERSION = "0.1.0";
const PROTOCOL_VERSION = "0.1";

export interface HealthResponse {
  status: "ok";
  service: "clawflow-gateway";
  timestamp: string;
}

export interface VersionResponse {
  name: "ClawFlow Studio Gateway";
  version: string;
  protocolVersion: string;
  runtimeMode: "mock";
}

export function createServer(): FastifyInstance {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  server.get("/health", async (): Promise<HealthResponse> => ({
    status: "ok",
    service: "clawflow-gateway",
    timestamp: new Date().toISOString()
  }));

  server.get("/api/version", async (): Promise<VersionResponse> => ({
    name: "ClawFlow Studio Gateway",
    version: VERSION,
    protocolVersion: PROTOCOL_VERSION,
    runtimeMode: "mock"
  }));

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);

  await server.listen({
    host: "0.0.0.0",
    port
  });
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
