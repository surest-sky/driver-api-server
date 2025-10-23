import { Module } from '@nestjs/common';
import { AccountSecurityController } from './account-security.controller';
import { AccountSecurityService } from './account-security.service';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { EmailCodeStore } from './email-code.store';

@Module({
  imports: [UsersModule, MailModule],
  controllers: [AccountSecurityController],
  providers: [AccountSecurityService, EmailCodeStore],
})
export class AccountSecurityModule {}
