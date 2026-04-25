import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private app: admin.app.App | null = null;

  constructor() {
    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!encoded) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — FCM push notifications disabled');
      return;
    }
    try {
      const serviceAccount = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
      // Only initialize once (guard against hot-reload re-init)
      if (!admin.apps.length) {
        this.app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      } else {
        this.app = admin.app();
      }
      this.logger.log('Firebase Admin SDK initialized');
    } catch (err) {
      this.logger.error(`Failed to initialize Firebase Admin SDK: ${err}`);
    }
  }

  async sendPush(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.app) {
      this.logger.warn('FCM not initialized — skipping push notification');
      return false;
    }
    try {
      await admin.messaging(this.app).send({
        token,
        notification: { title, body },
        data: data ?? {},
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
      this.logger.log(`FCM push sent to token ${token.substring(0, 12)}...`);
      return true;
    } catch (err) {
      this.logger.error(`FCM push failed: ${err}`);
      return false;
    }
  }

  async sendMulticast(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.app || tokens.length === 0) {
      return { successCount: 0, failureCount: tokens.length };
    }
    try {
      const response = await admin.messaging(this.app).sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: data ?? {},
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
      return { successCount: response.successCount, failureCount: response.failureCount };
    } catch (err) {
      this.logger.error(`FCM multicast failed: ${err}`);
      return { successCount: 0, failureCount: tokens.length };
    }
  }
}
