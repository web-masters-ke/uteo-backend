import { Controller, Get, Post, Delete, Param, Query, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MediaService } from './media.service';
import { S3Service } from '../../common/services/s3.service';

// Ensure the upload directory exists. Multer with a string destination does
// not auto-create the dir and will 500 with ENOENT on the first request
// after a fresh pod start. Use os.tmpdir() so we don't assume /tmp exists.
const UPLOAD_DIR = path.join(os.tmpdir(), 'uteo-uploads');
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch { /* dir already exists or unwritable */ }

const storage = diskStorage({
  destination: (_req, _file, cb) => {
    // Re-create on every request in case the OS reaped /tmp between requests.
    fs.mkdir(UPLOAD_DIR, { recursive: true }, (err) => cb(err, UPLOAD_DIR));
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

@Controller('media')
export class MediaController {
  constructor(private readonly svc: MediaService, private readonly s3: S3Service) {}

  /** Upload via disk (temp file → S3) — handles any file size without OOM */
  @Post('upload') @UseInterceptors(FileInterceptor('file', { storage, limits: { fileSize: 500*1024*1024 } }))
  upload(@UploadedFile() file: Express.Multer.File, @Query('folder') folder?: string) { return this.svc.upload(file, folder||'uploads'); }

  /** Presigned URL for direct-to-S3 upload (large files — videos) */
  @Post('presign')
  presign(@Body() body: { fileName: string; mimeType: string; folder?: string }) {
    return this.s3.getPresignedUploadUrl(body.fileName, body.mimeType, body.folder || 'videos');
  }

  @Get(':key(*)') getUrl(@Param('key') key: string) { return this.svc.getSignedUrl(key); }
  @Delete(':key(*)') remove(@Param('key') key: string) { return this.svc.delete(key); }
}
