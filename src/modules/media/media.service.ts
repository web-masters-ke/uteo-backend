import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { S3Service } from '../../common/services/s3.service';
import * as fs from 'fs';

const ALLOWED = ['image/jpeg','image/png','image/gif','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','video/mp4','video/quicktime','video/webm','video/x-msvideo','video/x-matroska','video/3gpp','audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'];
const MAX_SIZE = 500*1024*1024;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  constructor(private readonly s3: S3Service) {}

  // Folders whose objects should be publicly readable (company branding, covers)
  private static PUBLIC_FOLDERS = ['company-logos', 'avatars', 'cover-images'];

  async upload(file: Express.Multer.File, folder = 'uploads') {
    const isPublic = MediaService.PUBLIC_FOLDERS.some((f) => folder.startsWith(f));
    if (!file) throw new BadRequestException('No file provided');
    if (!ALLOWED.includes(file.mimetype)) throw new BadRequestException(`File type ${file.mimetype} not allowed`);
    if (file.size > MAX_SIZE) throw new BadRequestException('File too large (max 500MB)');

    // If multer used disk storage, read from disk path; otherwise use buffer
    let fileData: Buffer;
    if (file.path) {
      this.logger.log(`Reading ${file.originalname} (${(file.size / 1024 / 1024).toFixed(1)}MB) from disk: ${file.path}`);
      try {
        fileData = fs.readFileSync(file.path);
      } catch (err: any) {
        this.logger.error(`Failed to read temp file ${file.path}: ${err?.message ?? err}`);
        throw new BadRequestException('Upload failed reading the temp file');
      } finally {
        // Best-effort cleanup; do not fail the upload if cleanup fails
        try { fs.unlinkSync(file.path); } catch (cleanupErr: any) {
          this.logger.warn(`Could not unlink temp file ${file.path}: ${cleanupErr?.message ?? cleanupErr}`);
        }
      }
    } else {
      fileData = file.buffer;
    }

    try {
      const result = await this.s3.upload(fileData, file.originalname, file.mimetype, folder, isPublic);
      this.logger.log(`Uploaded ${file.originalname} to S3: ${result.url}`);
      return { key: result.key, url: result.url, originalName: file.originalname, mimeType: file.mimetype, size: file.size };
    } catch (err: any) {
      // Surface the real cause (S3 creds, bucket, endpoint) to the logs and the client
      const code = err?.name ?? err?.Code ?? 'S3Error';
      this.logger.error(`S3 upload failed (${code}): ${err?.message ?? err}`);
      throw new BadRequestException(`S3 upload failed (${code}): ${err?.message ?? 'unknown'}`);
    }
  }

  async getSignedUrl(key: string) { return { url: await this.s3.getSignedUrl(key), key }; }
  async delete(key: string) { await this.s3.delete(key); return { message: 'File deleted' }; }
}
