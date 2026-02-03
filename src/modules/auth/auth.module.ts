import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { School } from '../schools/school.entity';
import { MailModule } from '../mail/mail.module';
import { PasswordResetStore } from './password-reset.store';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, School]), 
    UsersModule,
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'change_me_secret'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    })
  ],
  providers: [AuthService, PasswordResetStore],
  controllers: [AuthController],
})
export class AuthModule {}
