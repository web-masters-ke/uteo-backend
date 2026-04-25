import { Injectable, Logger } from '@nestjs/common';

interface SendEmailOptions {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

@Injectable()
export class BrevoService {
  private readonly logger = new Logger(BrevoService.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly apiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor() {
    this.apiKey = process.env.BREVO_API_KEY || '';
    this.fromEmail = process.env.BREVO_FROM_EMAIL || 'noreply@uteo.co.ke';
    this.fromName = process.env.EMAIL_FROM_NAME || 'PTAK';
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
      const body = {
        sender: { name: this.fromName, email: this.fromEmail },
        to: options.to,
        subject: options.subject,
        htmlContent: options.htmlContent,
        textContent: options.textContent,
      };
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Brevo API error: ${response.status} - ${errorBody}`);
        return false;
      }
      this.logger.log(`Email sent to ${options.to.map((t) => t.email).join(', ')}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error}`);
      return false;
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    return this.sendEmail({
      to: [{ email, name: firstName }],
      subject: 'Welcome to PTAK',
      htmlContent: `<h1>Welcome to PTAK, ${firstName}!</h1><p>Thank you for joining the Professional Trainers Association of Kenya platform.</p><p>Best regards,<br/>The PTAK Team</p>`,
    });
  }

  async sendPasswordResetEmail(email: string, firstName: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
    return this.sendEmail({
      to: [{ email, name: firstName }],
      subject: 'Reset Your PTAK Password',
      htmlContent: `<h1>Password Reset</h1><p>Hi ${firstName},</p><p>Click to reset: <a href="${resetUrl}">${resetUrl}</a></p><p>Expires in 1 hour.</p>`,
    });
  }

  async sendBookingConfirmationEmail(email: string, firstName: string, details: { trainerName: string; date: string; time: string; sessionType: string }): Promise<boolean> {
    return this.sendEmail({
      to: [{ email, name: firstName }],
      subject: 'Booking Confirmed - PTAK',
      htmlContent: `<h1>Booking Confirmed!</h1><p>Hi ${firstName},</p><p>Session with <strong>${details.trainerName}</strong> on ${details.date} at ${details.time} (${details.sessionType}).</p>`,
    });
  }

  async sendNotificationEmail(email: string, name: string, title: string, message: string): Promise<boolean> {
    return this.sendEmail({
      to: [{ email, name }],
      subject: title,
      htmlContent: `<h1>${title}</h1><p>Hi ${name},</p><p>${message}</p><p>Best regards,<br/>The PTAK Team</p>`,
    });
  }

  /**
   * Simple convenience overload: send a transactional email with a plain string recipient.
   * Matches the signature expected by NotificationsService and external callers.
   */
  async sendTransactionalEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
    return this.sendEmail({ to: [{ email: to }], subject, htmlContent });
  }
}
