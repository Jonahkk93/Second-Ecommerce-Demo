import { Body, Controller, Delete, ForbiddenException, Injectable, Module, Param, Post, Req, ServiceUnavailableException, UnsupportedMediaTypeException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { IsIn, IsString, IsUrl, MaxLength } from "class-validator";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { randomUUID } from "node:crypto";
import { FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { AuthGuard, AuthUser, CurrentUser } from "../common/auth";

const mediaTypes: Record<string, { extension: string; kind: "image" | "video"; signature: (buffer: Buffer) => boolean }> = {
  "image/jpeg": { extension: "jpg", kind: "image", signature: buffer => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  "image/png": { extension: "png", kind: "image", signature: buffer => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { extension: "webp", kind: "image", signature: buffer => buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP" },
  "image/gif": { extension: "gif", kind: "image", signature: buffer => ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString()) },
  "video/mp4": { extension: "mp4", kind: "video", signature: buffer => buffer.subarray(4, 8).toString() === "ftyp" },
  "video/quicktime": { extension: "mov", kind: "video", signature: buffer => buffer.subarray(4, 8).toString() === "ftyp" },
  "video/webm": { extension: "webm", kind: "video", signature: buffer => buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) }
};

class DeleteMediaDto { @IsString() key!: string; }
class ImportMediaDto {
  @IsUrl({ protocols: ["http", "https"], require_protocol: true }) @MaxLength(500) url!: string;
  @IsIn(["banner"]) purpose!: "banner";
}
export type MultipartRequest = FastifyRequest & { file(options?: { limits?: { files?: number; fileSize?: number } }): Promise<MultipartFile | undefined> };

@Injectable()
export class MediaService {
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

  private isPrivateAddress(address: string): boolean {
    if (isIP(address) === 4) {
      const octets = address.split(".").map(Number);
      return octets[0] === 10 || octets[0] === 127 || octets[0] === 0 ||
        (octets[0] === 169 && octets[1] === 254) || (octets[0] === 192 && octets[1] === 168) ||
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || octets[0] >= 224;
    }
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) return this.isPrivateAddress(normalized.slice(7));
    return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("ff");
  }

  private async assertPublicRemoteUrl(value: string) {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) throw new UnsupportedMediaTypeException("Use a public HTTP or HTTPS image URL");
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(item => this.isPrivateAddress(item.address))) throw new UnsupportedMediaTypeException("Private or local image URLs are not allowed");
    return url;
  }

  private imageType(buffer: Buffer) {
    return Object.entries(mediaTypes).find(([, type]) => type.kind === "image" && type.signature(buffer));
  }

  private async storeBuffer(user: AuthUser, purpose: string, buffer: Buffer, contentType: string, originalName: string) {
    const type = mediaTypes[contentType];
    const key = `${purpose}/${user.sub}/${randomUUID()}.${type.extension}`;
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable", Metadata: { originalName: encodeURIComponent(originalName).slice(0, 900) } }));
    return { key, url: `${this.publicBaseUrl}/${key}`, contentType, size: buffer.length };
  }

  async upload(user: AuthUser, purpose: string, request: MultipartRequest) {
    this.assertConfigured();
    if (!["profile", "review", "product", "banner", "appeal"].includes(purpose)) throw new UnsupportedMediaTypeException("Unsupported media purpose");
    if (["product", "banner"].includes(purpose) && user.role !== "admin") throw new ForbiddenException("Admin access required for storefront images");
    const maxFileSize = purpose === "product" ? 50 * 1024 * 1024 : purpose === "banner" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    const file = await request.file({ limits: { files: 1, fileSize: maxFileSize } });
    if (!file) throw new UnsupportedMediaTypeException("Media file is required");
    const type = mediaTypes[file.mimetype];
    if (!type || (type.kind === "video" && purpose !== "product")) throw new UnsupportedMediaTypeException(purpose === "product" ? "Use JPEG, PNG, WebP, GIF, MP4, MOV, or WebM media" : "Use a JPEG, PNG, WebP, or GIF image");
    const buffer = await file.toBuffer();
    if (!type.signature(buffer)) throw new UnsupportedMediaTypeException("Media contents do not match its file type");
    return this.storeBuffer(user, purpose, buffer, file.mimetype, file.filename);
  }

  async importRemote(user: AuthUser, purpose: string, source: string) {
    this.assertConfigured();
    if (user.role !== "admin" || purpose !== "banner") throw new ForbiddenException("Admin access required for banner images");
    let url = await this.assertPublicRemoteUrl(source);
    let response: Response | undefined;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10000), headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" } });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) throw new UnsupportedMediaTypeException("The image URL redirects without a destination");
      url = await this.assertPublicRemoteUrl(new URL(location, url).href);
      response.body?.cancel().catch(() => {});
      response = undefined;
    }
    if (!response?.ok || !response.body) throw new UnsupportedMediaTypeException("The image URL could not be downloaded");
    const declaredSize = Number(response.headers.get("content-length") || 0);
    const maxSize = 5 * 1024 * 1024;
    if (declaredSize > maxSize) throw new UnsupportedMediaTypeException("Remote hero images must be 5 MB or smaller");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxSize) {
        await reader.cancel();
        throw new UnsupportedMediaTypeException("Remote hero images must be 5 MB or smaller");
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
    const detected = this.imageType(buffer);
    if (!detected) throw new UnsupportedMediaTypeException("The URL must return a JPEG, PNG, WebP, or GIF image");
    const [contentType] = detected;
    const originalName = (url.pathname.split("/").pop() || "remote-hero-image").slice(0, 255);
    return this.storeBuffer(user, purpose, buffer, contentType, originalName);
  }

  uploadAppeal(userId: string, request: MultipartRequest) { return this.upload({ sub: userId, email: "", role: "customer" }, "appeal", request); }

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
  @Post("import") importRemote(@CurrentUser() user: AuthUser, @Body() dto: ImportMediaDto) { return this.media.importRemote(user, dto.purpose, dto.url); }
  @Delete() remove(@CurrentUser() user: AuthUser, @Body() dto: DeleteMediaDto) { return this.media.remove(user, dto.key); }
}

@Module({ controllers: [MediaController], providers: [MediaService], exports: [MediaService] })
export class MediaModule {}
