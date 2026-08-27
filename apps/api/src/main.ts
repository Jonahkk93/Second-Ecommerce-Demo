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
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ bodyLimit: 1_000_000 }), { rawBody: true });
  const config = app.get(ConfigService);
  // npm workspaces can resolve Nest's Fastify and plugin types from separate paths.
  await app.register(cookie as never);
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { files: 1, fileSize: 5 * 1024 * 1024 } });
  const allowedOrigins = String(config.get("WEB_ORIGIN", "http://127.0.0.1:5501")).split(",").map(origin => origin.trim()).filter(Boolean);
  app.enableCors({ origin: allowedOrigins, credentials: true, methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] });
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(Number(config.get("PORT", 3000)), "0.0.0.0");
}
bootstrap();
