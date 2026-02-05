import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

export type MailRegion = 'domestic' | 'overseas';

interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly config: MailConfig;

  constructor() {
    const region = (process.env.SMTP_REGION as MailRegion | undefined) ?? 'domestic';
    const defaults = this.resolveDefaults(region);

    const user = process.env.SMTP_USER || defaults.user;
    const pass = process.env.SMTP_PASS || defaults.pass;

    if (!user || !pass) {
      this.logger.warn('SMTP_USER/SMTP_PASS not configured, email sending may fail');
    }

    this.config = {
      host: process.env.SMTP_HOST || defaults.host,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : defaults.port,
      secure: true,
      user,
      pass,
      fromName: process.env.SMTP_FROM_NAME || 'Surest Notification',
    };

    this.transporter = createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });

    this.logger.log(`SMTP transporter initialized: host=${this.config.host}, port=${this.config.port}, region=${region}`);
  }

  private resolveDefaults(region: MailRegion): MailConfig {
    if (region === 'overseas') {
      return {
        host: 'hwsmtp.exmail.qq.com',
        port: 465,
        secure: true,
        user: 'chenf@surest.cn',
        pass: 'zEpHeKTNMjbgBsyg',
      };
    }
    return {
      host: 'smtp.exmail.qq.com',
      port: 465,
      secure: true,
      user: 'chenf@surest.cn',
      pass: 'zEpHeKTNMjbgBsyg',
    };
  }

  async sendMail(options: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
  }): Promise<void> {
    const fromAddress = this.config.fromName
      ? `${this.config.fromName} <${this.config.user}>`
      : this.config.user;

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
      });

      this.logger.log(`Email sent: messageId=${info.messageId}`);
    } catch (error) {
      this.logger.error('Failed to send email', error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }
}
