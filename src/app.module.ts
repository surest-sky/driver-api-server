import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { UsersModule } from "./modules/users/users.module";
import { AuthModule } from "./modules/auth/auth.module";
import { PoliciesModule } from "./modules/policies/policies.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { InvitesModule } from "./modules/invites/invites.module";
import { SchoolsModule } from "./modules/schools/schools.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { User } from "./modules/users/user.entity";
import { Policy } from "./modules/policies/policy.entity";
import { Conversation } from "./modules/messages/conversation.entity";
import { Message } from "./modules/messages/message.entity";
import { Invite } from "./modules/invites/invite.entity";
import { School } from "./modules/schools/school.entity";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { Appointment } from "./modules/appointments/appointment.entity";
import { Notification } from "./modules/notifications/notification.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: "mysql",
        host: process.env.DB_HOST || "127.0.0.1",
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 33067,
        username: process.env.DB_USER || "root",
        password: process.env.DB_PASS || "12345",
        database: process.env.DB_NAME || "driver_app",
        entities: [User, Policy, Conversation, Message, Invite, School, Appointment, Notification],
        synchronize: false,
      }),
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || "change_me_secret",
      signOptions: { expiresIn: "7d" },
    }),
    UsersModule,
    AuthModule,
    PoliciesModule,
    MessagesModule,
    InvitesModule,
    SchoolsModule,
    UploadsModule,
    AppointmentsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
