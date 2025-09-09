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
import { AppointmentsModule } from "./modules/appointments/appointments.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const cfg = {
          type: "mysql" as const,
          host: process.env.DB_HOST || "127.0.0.1",
          port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 33067,
          username: process.env.DB_USER || "root",
          password: process.env.DB_PASS || "12345",
          database: process.env.DB_NAME || "driver_app",
          autoLoadEntities: true,
          synchronize: false,
          logging: [
            "error",
          ] as ("log" | "info" | "warn" | "error" | "query" | "schema" | "migration")[],
        };
        // 显示关键连接参数，便于定位问题（不打印密码）
        // eslint-disable-next-line no-console
        console.log("[TypeORM] config:", {
          host: cfg.host,
          port: cfg.port,
          username: cfg.username,
          database: cfg.database,
        });
        return cfg;
      },
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
