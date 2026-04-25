import { Controller, Get, Post, Delete, Param, Query, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { MediaService } from './media.service';
import { S3Service } from '../../common/services/s3.service';

const storage = diskStorage({ destination: '/tmp/ptak-uploads', filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`) });

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
