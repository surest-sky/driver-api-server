import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MailService } from '../modules/mail/mail.service';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const mailService = appContext.get(MailService);

  const to = process.argv[2] ?? 'surest.sky@gmail.com';
  const subject = process.argv[3] ?? 'SMTP Test Email';
  const bodyText = process.argv[4] ?? 'This is a test email from Node.js SMTP service.';
  const code = process.argv[5] ?? generateCode();

  try {
    await mailService.sendMail({
      to,
      subject,
      text: bodyText,
      html: buildHtmlTemplate(code, bodyText),
    });
    // eslint-disable-next-line no-console
    console.log(`Email sent to ${to}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to send email:', error);
  } finally {
    await appContext.close();
  }
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Script execution failed:', error);
  process.exitCode = 1;
});

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildHtmlTemplate(code: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SMTP Test Email</title>
  </head>
  <body style="margin:0;padding:24px;background:#f3f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center">
          <table width="520" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background:#ffffff;border-radius:18px;padding:32px;box-shadow:0 18px 45px rgba(41,72,152,0.12);">
            <tr>
              <td style="text-align:center;">
                <div style="display:inline-block;padding:12px 20px;border-radius:999px;background:linear-gradient(135deg,#2196F3,#6EC6FF);color:#fff;font-weight:600;letter-spacing:0.6px;">Surest SMTP Test</div>
                <h2 style="margin:24px 0 12px;font-size:24px;color:#0d1c2e;">Email Template Demo</h2>
                <p style="margin:0 0 24px;color:#4a5b6c;font-size:15px;line-height:1.6;">${message}</p>
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
                <p style="margin:0 0 18px;">You can pass a custom verification code in the fifth parameter; otherwise, a random one will be used.</p>
                <p style="margin:0;color:#8092a4;">— Surest Mail Service</p>
              </td>
            </tr>
          </table>
          <p style="margin-top:24px;font-size:12px;color:#9aa7b7;">This email was sent by a test script for template demonstration only.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
