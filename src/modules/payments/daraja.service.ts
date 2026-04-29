import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/**
 * Daraja (Safaricom M-Pesa) STK Push client.
 *
 * Sandbox base: https://sandbox.safaricom.co.ke
 * Production base: https://api.safaricom.co.ke
 *
 * Required env:
 *   DARAJA_ENV=sandbox|production
 *   DARAJA_CONSUMER_KEY, DARAJA_CONSUMER_SECRET
 *   DARAJA_SHORTCODE — the Till/Paybill number
 *   DARAJA_PASSKEY — provided with the shortcode
 *   DARAJA_CALLBACK_URL — public URL Safaricom POSTs the result to
 *
 * When credentials are missing and DARAJA_FALLBACK_TO_MOCK=true, the service
 * returns a fake "STK push initiated" response so the UI can demo the flow.
 */
@Injectable()
export class DarajaService {
  private readonly logger = new Logger(DarajaService.name);
  private readonly axios: AxiosInstance;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor() {
    const base =
      (process.env.DARAJA_ENV || 'sandbox').toLowerCase() === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
    this.axios = axios.create({ baseURL: base, timeout: 20000 });
  }

  private get isConfigured(): boolean {
    return !!(
      process.env.DARAJA_CONSUMER_KEY &&
      process.env.DARAJA_CONSUMER_SECRET &&
      process.env.DARAJA_SHORTCODE &&
      process.env.DARAJA_PASSKEY
    );
  }

  private get fallbackToMock(): boolean {
    return (process.env.DARAJA_FALLBACK_TO_MOCK || '').toLowerCase() === 'true';
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.token;
    }
    const key = process.env.DARAJA_CONSUMER_KEY!;
    const secret = process.env.DARAJA_CONSUMER_SECRET!;
    const basic = Buffer.from(`${key}:${secret}`).toString('base64');
    const res = await this.axios.get(
      '/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${basic}` } },
    );
    const token = res.data?.access_token as string;
    const expiresIn = Number(res.data?.expires_in || 3599) * 1000;
    if (!token) throw new Error('Daraja OAuth returned no access_token');
    this.cachedToken = { token, expiresAt: now + expiresIn };
    return token;
  }

  private formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('254')) return digits;
    if (digits.startsWith('0')) return '254' + digits.slice(1);
    if (digits.startsWith('7') || digits.startsWith('1')) return '254' + digits;
    return digits;
  }

  private buildPassword(shortcode: string, passkey: string, timestamp: string) {
    return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  }

  private timestamp(): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  /**
   * Send an STK push to the given phone. Returns merchantRequestId +
   * checkoutRequestId that we store on the Payment row so the callback can
   * reconcile.
   */
  async stkPush(params: {
    phone: string;
    amount: number;
    accountReference: string;
    description?: string;
  }): Promise<{
    merchantRequestId: string;
    checkoutRequestId: string;
    responseCode: string;
    responseDescription: string;
    customerMessage: string;
    mock?: boolean;
  }> {
    // Mock takes priority — checked before anything else so dev works without a live callback URL
    if (this.fallbackToMock) {
      this.logger.warn(
        `DARAJA_FALLBACK_TO_MOCK=true — returning mock STK push for ${params.phone}`,
      );
      return {
        merchantRequestId: `MOCK-${Date.now()}`,
        checkoutRequestId: `ws_CO_MOCK_${Date.now()}`,
        responseCode: '0',
        responseDescription: '[Mock] STK push simulated',
        customerMessage: 'Success. Request accepted for processing',
        mock: true,
      };
    }

    if (!this.isConfigured) {
      throw new BadRequestException(
        'M-Pesa is not configured — set DARAJA_CONSUMER_KEY, DARAJA_CONSUMER_SECRET, DARAJA_SHORTCODE, DARAJA_PASSKEY in .env',
      );
    }

    const shortcode = process.env.DARAJA_SHORTCODE!;
    const passkey = process.env.DARAJA_PASSKEY!;
    const callback = process.env.DARAJA_CALLBACK_URL;
    if (!callback) {
      throw new BadRequestException(
        'DARAJA_CALLBACK_URL must be set to a public URL Safaricom can POST to',
      );
    }
    const ts = this.timestamp();
    const token = await this.getAccessToken();
    const body = {
      BusinessShortCode: shortcode,
      Password: this.buildPassword(shortcode, passkey, ts),
      Timestamp: ts,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(params.amount),
      PartyA: this.formatPhone(params.phone),
      PartyB: shortcode,
      PhoneNumber: this.formatPhone(params.phone),
      CallBackURL: callback,
      AccountReference: (params.accountReference || 'Uteo').slice(0, 12),
      TransactionDesc: (params.description || 'Uteo wallet top-up').slice(0, 13),
    };

    try {
      const res = await this.axios.post('/mpesa/stkpush/v1/processrequest', body, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const d = res.data as any;
      this.logger.log(
        `STK push -> ${params.phone} (${params.amount}) merchantReq=${d.MerchantRequestID} checkoutReq=${d.CheckoutRequestID}`,
      );
      return {
        merchantRequestId: d.MerchantRequestID,
        checkoutRequestId: d.CheckoutRequestID,
        responseCode: d.ResponseCode,
        responseDescription: d.ResponseDescription,
        customerMessage: d.CustomerMessage,
      };
    } catch (err: any) {
      const msg =
        err?.response?.data?.errorMessage ||
        err?.response?.data?.ResponseDescription ||
        err?.message ||
        'Daraja STK push failed';
      this.logger.error(`STK push failed: ${msg}`, err?.stack);
      throw new BadRequestException(`M-Pesa: ${msg}`);
    }
  }

  /**
   * Parse Safaricom's callback payload into a normalized result.
   * Callback shape: { Body: { stkCallback: { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata? } } }
   */
  parseCallback(body: any): {
    merchantRequestId: string;
    checkoutRequestId: string;
    success: boolean;
    resultCode: number;
    resultDesc: string;
    amount?: number;
    mpesaReceiptNumber?: string;
    phoneNumber?: string;
    transactionDate?: string;
  } {
    const cb = body?.Body?.stkCallback || {};
    const items = cb?.CallbackMetadata?.Item as Array<{ Name: string; Value: any }> | undefined;
    const pick = (name: string) => items?.find((i) => i.Name === name)?.Value;
    return {
      merchantRequestId: cb.MerchantRequestID,
      checkoutRequestId: cb.CheckoutRequestID,
      success: cb.ResultCode === 0,
      resultCode: cb.ResultCode,
      resultDesc: cb.ResultDesc,
      amount: pick('Amount') as number | undefined,
      mpesaReceiptNumber: pick('MpesaReceiptNumber') as string | undefined,
      phoneNumber: pick('PhoneNumber')?.toString(),
      transactionDate: pick('TransactionDate')?.toString(),
    };
  }
}
