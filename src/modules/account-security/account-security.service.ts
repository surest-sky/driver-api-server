import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { EmailCodeStore } from './email-code.store';

@Injectable()
export class AccountSecurityService {
  private static readonly CODE_TTL_MS = 10 * 60 * 1000; // 10 min

  constructor(
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly codeStore: EmailCodeStore,
  ) {}

  async sendEmailCode(userId: number, rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const current = await this.users.findById(userId);
    if (!current) {
      throw new BadRequestException('用户不存在');
    }
    if (current.email === email) {
      throw new BadRequestException('新邮箱不能与当前邮箱相同');
    }
    const existing = await this.users.findByEmail(email);
    if (existing && existing.id !== userId) {
      throw new BadRequestException('该邮箱已被占用');
    }

    const code = this.generateCode();
    this.codeStore.set(userId, email, code, AccountSecurityService.CODE_TTL_MS);

    await this.mail.sendMail({
      to: email,
      subject: 'Surest 账户邮箱验证',
      text: this.buildPlainText(code),
      html: this.buildHtmlTemplate(code),
    });

    this.codeStore.cleanupExpired();
  }

  async updateEmail(userId: number, rawEmail: string, code: string) {
    const email = rawEmail.trim().toLowerCase();
    if (!this.codeStore.verify(userId, email, code)) {
      throw new BadRequestException('验证码错误或已过期');
    }
    const existing = await this.users.findByEmail(email);
    if (existing && existing.id !== userId) {
      throw new BadRequestException('该邮箱已被占用');
    }
    return this.users.updateUser(userId, { email });
  }

  async updatePassword(userId: number, newPassword: string) {
    const trimmed = newPassword?.trim() ?? '';
    if (trimmed.length <= 6) {
      throw new BadRequestException('密码长度需大于6个字符');
    }
    const passwordHash = await bcrypt.hash(trimmed, 10);
    await this.users.updateUser(userId, { passwordHash });
  }

  private generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private buildPlainText(code: string): string {
    return `您好！\n\n您正在修改 Surest 账户的登录邮箱，验证码如下：\n${code}\n\n验证码 10 分钟内有效，请尽快完成验证。如非本人操作，请忽略本邮件。\n\nSurest 团队`;
  }

  private buildHtmlTemplate(code: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>邮箱验证</title>
  </head>
  <body style="margin:0;padding:24px;background:#f2f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;background:#ffffff;border-radius:18px;padding:32px;box-shadow:0 18px 45px rgba(41,72,152,0.18);">
            <tr>
              <td style="text-align:center;">
                <div style="display:inline-block;padding:12px 20px;border-radius:999px;background:linear-gradient(135deg,#2196F3,#6EC6FF);color:#fff;font-weight:600;letter-spacing:0.6px;">Surest Account</div>
                <h2 style="margin:24px 0 12px;font-size:24px;color:#0d1c2e;">验证您的新邮箱</h2>
                <p style="margin:0 0 24px;color:#4a5b6c;font-size:15px;line-height:1.6;">我们收到您修改登录邮箱的请求，请在 10 分钟内输入以下验证码完成验证。</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="display:inline-block;padding:18px 42px;border-radius:16px;background:#ffffff;color:#0d1c2e;font-size:28px;font-weight:700;letter-spacing:6px;box-shadow:0 14px 30px rgba(26,115,232,0.25);border:1px solid rgba(26,115,232,0.25);">
                  ${code}
                </div>
              </td>
            </tr>
            <tr>
              <td style="color:#4a5b6c;font-size:13px;line-height:1.6;text-align:center;">
                <p style="margin:0 0 18px;">如果这不是您的操作，请忽略此邮件并及时检查账号安全设置。</p>
                <p style="margin:0;color:#8092a4;">— Surest 安全团队</p>
              </td>
            </tr>
          </table>
          <p style="margin-top:24px;font-size:12px;color:#9aa7b7;">本邮件由系统自动发送，请勿直接回复。</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }
}
