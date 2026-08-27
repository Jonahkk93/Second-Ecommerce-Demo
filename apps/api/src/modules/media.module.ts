import { Body, Controller, Delete, ForbiddenException, Injectable, Module, Param, Post, Req, ServiceUnavailableException, UnsupportedMediaTypeException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { IsString } from "class-validator";
import { randomUUID } from "node:crypto";
import { FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { AuthGuard, AuthUser, CurrentUser } from "../common/auth";

const imageTypes: Record<string, { extension: string; signature: (buffer: Buffer) => boolean }> = {
  "image/jpeg": { extension: "jpg", signature: buffer => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  "image/png": { extension: "png", signature: buffer => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { extension: "webp", signature: buffer => buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP" },
  "image/gif": { extension: "gif", signature: buffer => ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString()) }
};

class DeleteMediaDto { @IsString() key!: string; }
type MultipartRequest = FastifyRequest & { file(options?: { limits?: { files?: number; fileSize?: number } }): Promise<MultipartFile | undefined> };

@Injectable()
class MediaService {
  private readonly accountId: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly client: S3Client;

  constructor(config: ConfigService) {
    this.accountId = config.get("R2_ACCOUNT_ID", "");
    this.accessKeyId = config.get("R2_ACCESS_KEY_ID", "");
    this.secretAccessKey = config.get("R2_SECRET_ACCESS_KEY", "");
    this.bucket = config.get("R2_BUCKET", "");
    this.publicBaseUrl = String(config.get("R2_PUBLIC_BASE_URL", "")).replace(/\/$/, "");
    this.client = new S3Client({ region: "auto", endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: this.accessKeyId, secretAccessKey: this.secretAccessKey } });
  }

  private assertConfigured() {
    if (![this.accountId, this.accessKeyId, this.secretAccessKey, this.bucket, this.publicBaseUrl].every(Boolean)) throw new ServiceUnavailableException("Media storage is not configured");
  }

  async upload(user: AuthUser, purpose: string, request: MultipartRequest) {
    this.assertConfigured();
    if (!["profile", "review", "product"].includes(purpose)) throw new UnsupportedMediaTypeException("Unsupported media purpose");
    if (purpose === "product" && user.role !== "admin") throw new ForbiddenException("Admin access required for product images");
    const file = await request.file({ limits: { files: 1, fileSize: 5 * 1024 * 1024 } });
    if (!file) throw new UnsupportedMediaTypeException("Image file is required");
    const type = imageTypes[file.mimetype];
    if (!type) throw new UnsupportedMediaTypeException("Use a JPEG, PNG, WebP, or GIF image");
    const buffer = await file.toBuffer();
    if (!type.signature(buffer)) throw new UnsupportedMediaTypeException("Image contents do not match its file type");
    const key = `${purpose}/${user.sub}/${randomUUID()}.${type.extension}`;
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: file.mimetype, CacheControl: "public, max-age=31536000, immutable", Metadata: { originalName: encodeURIComponent(file.filename).slice(0, 900) } }));
    return { key, url: `${this.publicBaseUrl}/${key}`, contentType: file.mimetype, size: buffer.length };
  }

  async remove(user: AuthUser, key: string) {
    this.assertConfigured();
    if (user.role !== "admin" && !key.startsWith(`profile/${user.sub}/`) && !key.startsWith(`review/${user.sub}/`)) throw new ForbiddenException("You cannot remove this image");
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    return { ok: true };
  }
}

@UseGuards(AuthGuard)
@Controller("media")
class MediaController {
  constructor(private readonly media: MediaService) {}
  @Post("uploads/:purpose") upload(@CurrentUser() user: AuthUser, @Param("purpose") purpose: string, @Req() request: MultipartRequest) { return this.media.upload(user, purpose, request); }
  @Delete() remove(@CurrentUser() user: AuthUser, @Body() dto: DeleteMediaDto) { return this.media.remove(user, dto.key); }
}

@Module({ controllers: [MediaController], providers: [MediaService] })
export class MediaModule {}
