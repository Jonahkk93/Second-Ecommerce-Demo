import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ bodyLimit: 55 * 1024 * 1024 }), { rawBody: true });
  const config = app.get(ConfigService);
  const production = config.get("NODE_ENV") === "production";
  // npm workspaces can resolve Nest's Fastify and plugin types from separate paths.
  await app.register(cookie as never);
  await app.register(rateLimit, { max: production ? 120 : 2000, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { files: 1, fileSize: 50 * 1024 * 1024 } });
  const allowedOrigins = String(config.get("WEB_ORIGIN", "http://127.0.0.1:5501")).split(",").map(origin => origin.trim()).filter(Boolean);
  const localOrigin = /^https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[::1\]|(?:[a-z0-9-]+\.)*local|[a-z0-9-]+)(?::\d+)?$/i;
  app.enableCors({
    origin(origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) {
      // Browsers use many ports and LAN addresses for local device previews.
      // Permit private-network origins in development while keeping production
      // restricted to WEB_ORIGIN.
      const allowed = !origin || allowedOrigins.includes(origin) || (!production && localOrigin.test(origin));
      callback(allowed ? null : new Error("Origin is not allowed"), allowed);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(Number(config.get("PORT", 3000)), "0.0.0.0");
}
bootstrap();
