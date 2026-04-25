import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BongaSmsService {
  private readonly logger = new Logger(BongaSmsService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly clientId: string;
  private readonly serviceId: string;

  constructor() {
    this.apiUrl = process.env.BONGA_SMS_URL || 'http://167.172.14.50:4002/v1/send-sms';
    this.apiKey = process.env.BONGA_API_KEY || '';
    this.apiSecret = process.env.BONGA_API_SECRET || '';
    this.clientId = process.env.BONGA_CLIENT_ID || '';
    this.serviceId = process.env.BONGA_SERVICE_ID || '';
  }

  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const body = {
        apiClientID: this.clientId,
        key: this.apiKey,
        secret: this.apiSecret,
        serviceID: this.serviceId,
        mobile: this.normalizePhone(phoneNumber),
        message,
      };
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Bonga SMS error: ${response.status} - ${errorBody}`);
        return false;
      }
      this.logger.log(`SMS sent to ${phoneNumber}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error}`);
      return false;
    }
  }

  async sendOtp(phoneNumber: string, otp: string): Promise<boolean> {
    return this.sendSms(phoneNumber, `Your PTAK verification code is: ${otp}. It expires in 10 minutes.`);
  }

  async sendBookingReminder(phoneNumber: string, trainerName: string, dateTime: string): Promise<boolean> {
    return this.sendSms(phoneNumber, `PTAK Reminder: Your session with ${trainerName} is scheduled for ${dateTime}.`);
  }

  private normalizePhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '254' + cleaned.slice(1);
    if (!cleaned.startsWith('254')) cleaned = '254' + cleaned;
    return cleaned;
  }
}
