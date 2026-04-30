import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor() {
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'eu-west-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucket = process.env.S3_BUCKET || 'universal-storage-account3-2026';
    this.prefix = process.env.S3_PREFIX || 'uteo/';
  }

  async upload(
    file: Buffer,
    originalName: string,
    mimeType: string,
    folder: string = 'uploads',
  ): Promise<{ key: string; url: string }> {
    const ext = originalName.split('.').pop() || 'bin';
    const key = `${this.prefix}${folder}/${uuid()}.${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: mimeType,
      }),
    );

    this.logger.log(`Uploaded ${key} to S3`);
    const url = `https://${this.bucket}.s3.${process.env.AWS_REGION || 'eu-west-2'}.amazonaws.com/${key}`;
    return { key, url };
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  /** Generate a presigned PUT URL so clients upload directly to S3 */
  async getPresignedUploadUrl(
    originalName: string,
    mimeType: string,
    folder: string = 'uploads',
    expiresIn = 3600,
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    const ext = originalName.split('.').pop() || 'bin';
    const key = `${this.prefix}${folder}/${uuid()}.${ext}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    const publicUrl = `https://${this.bucket}.s3.${process.env.AWS_REGION || 'eu-west-2'}.amazonaws.com/${key}`;
    return { uploadUrl, key, publicUrl };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    this.logger.log(`Deleted ${key} from S3`);
  }

  /**
   * Apply CORS so browsers can PUT directly to presigned URLs from our domains.
   * Idempotent — running again just overwrites the rules.
   */
  async applyCors(): Promise<{ bucket: string; rules: any[] }> {
    const rules = [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
        AllowedOrigins: [
          'https://uteo.ai',
          'https://admin.uteo.ai',
          'https://api.uteo.ai',
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3003',
        ],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3000,
      },
    ];
    await this.client.send(
      new PutBucketCorsCommand({
        Bucket: this.bucket,
        CORSConfiguration: { CORSRules: rules },
      }),
    );
    this.logger.log(`Applied CORS rules to bucket ${this.bucket}`);
    return { bucket: this.bucket, rules };
  }

  async getCors(): Promise<any> {
    try {
      const r = await this.client.send(new GetBucketCorsCommand({ Bucket: this.bucket }));
      return { bucket: this.bucket, rules: r.CORSRules };
    } catch (e: any) {
      return { bucket: this.bucket, rules: null, error: e?.name ?? String(e) };
    }
  }
}
