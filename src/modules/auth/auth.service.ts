import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as dayjs from "dayjs";
import { User, UserRole } from "../users/user.entity";
import { School } from "../schools/school.entity";
import { MailService } from "../mail/mail.service";
import { PasswordResetStore } from "./password-reset.store";

interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  role: UserRole;
  hasDrivingSchool?: boolean;
  drivingSchoolCode?: string;
  drivingSchoolName?: string;
  contactNumber?: string;
  avatarUrl?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly passwordResetStore: PasswordResetStore
  ) {}

  async login(email: string, password: string) {
    const user = await this.repo.findOne({ where: { email }, relations: ["school"] });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    // Seed compatibility: if no hash stored, accept default '123456' and set hash
    if (!user.passwordHash) {
      if (password !== "123456")
        throw new UnauthorizedException("Invalid credentials");
      user.passwordHash = await bcrypt.hash(password, 10);
      await this.repo.save(user);
    } else {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) throw new UnauthorizedException("Invalid credentials1");
    }

    return this.buildAuthPayload(user);
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.repo.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      throw new BadRequestException("Email already registered");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const { school, pendingSchoolCode } = await this.prepareSchoolForRegistration(dto);

    const fullName = `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();

    let birthDate: Date | null = null;
    if (dto.birthDate) {
      const parsed = new Date(dto.birthDate);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid birth date');
      }
      birthDate = parsed;
    }

    const user = this.repo.create({
      email: normalizedEmail,
      passwordHash,
      name: fullName,
      birthDate,
      avatarUrl: dto.avatarUrl ? dto.avatarUrl.trim() : null,
      role: dto.role,
      schoolId: school?.id ?? null,
      phone: dto.contactNumber ? dto.contactNumber.trim() : null,
      pendingSchoolCode: pendingSchoolCode,
    });

    const saved = await this.repo.save(user);
    const savedWithRelation = await this.repo.findOne({
      where: { id: saved.id },
      relations: ["school"],
    });

    if (!savedWithRelation) {
      throw new Error("User registration failed");
    }

    return this.buildAuthPayload(savedWithRelation);
  }

  async sendPasswordResetCode(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException("Email is required");
    }

    const user = await this.repo.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      return { ok: true };
    }

    const code = this.passwordResetStore.issueCode(normalizedEmail);
    await this.mail.sendMail({
      to: normalizedEmail,
      subject: "Password reset code",
      text: `Your verification code is ${code}. It is valid for 10 minutes. If you did not request this, please ignore this email.`,
      html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Password Reset</title>
  </head>
  <body style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0d1c2e;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;background:#ffffff;border-radius:18px;padding:32px;box-shadow:0 18px 45px rgba(15,23,42,0.12);">
            <tr>
              <td style="text-align:center;">
                <div style="display:inline-block;padding:10px 18px;border-radius:999px;background:linear-gradient(135deg,#3b82f6,#22d3ee);color:#ffffff;font-weight:600;letter-spacing:0.6px;">
                  Password Reset
                </div>
                <h2 style="margin:22px 0 10px;font-size:24px;color:#0d1c2e;">Your verification code</h2>
                <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6;">
                  Enter this code within 10 minutes to reset your password.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center">
                <div style="display:inline-block;padding:16px 36px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;color:#0f172a;font-size:26px;font-weight:700;letter-spacing:6px;">
                  ${code}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding-top:20px;text-align:center;">
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
                  If you did not request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin-top:24px;font-size:12px;color:#94a3b8;">This email was sent automatically. Please do not reply.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    });

    return { ok: true };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !code || !newPassword) {
      throw new BadRequestException("Email, code and new password are required");
    }
    if (newPassword.trim().length < 5) {
      throw new BadRequestException("Password too short");
    }

    const status = this.passwordResetStore.consumeCode(normalizedEmail, code.trim());
    if (status === 'expired') {
      throw new BadRequestException("Verification code expired");
    }
    if (status === 'mismatch' || status === 'missing') {
      throw new BadRequestException("Invalid verification code");
    }

    const user = await this.repo.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      throw new BadRequestException("Invalid verification code");
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.repo.save(user);

    return { ok: true };
  }

  private async prepareSchoolForRegistration(dto: RegisterDto) {
    if (dto.role === UserRole.coach) {
      if (!dto.drivingSchoolName || !dto.drivingSchoolName.trim()) {
        throw new BadRequestException("Driving school name is required for coach registration");
      }

      const { code, drivingSchoolCode } = await this.generateUniqueSchoolCodes();
      const school = this.schoolRepo.create({
        name: dto.drivingSchoolName.trim(),
        code,
        drivingSchoolCode,
      });
      const savedSchool = await this.schoolRepo.save(school);
      return { school: savedSchool, pendingSchoolCode: null as string | null };
    }

    if (dto.hasDrivingSchool && dto.drivingSchoolCode) {
      const trimmedCode = dto.drivingSchoolCode.trim().toUpperCase();
      const school = await this.schoolRepo.findOne({ where: { drivingSchoolCode: trimmedCode } });
      if (school) {
        return { school, pendingSchoolCode: null as string | null };
      }
      return { school: null, pendingSchoolCode: trimmedCode };
    }

    return { school: null as School | null, pendingSchoolCode: null as string | null };
  }

  private async generateUniqueSchoolCodes() {
    let code: string;
    let drivingSchoolCode: string;

    do {
      code = `SC${Math.floor(Math.random() * 900000 + 100000)}`;
    } while (await this.schoolRepo.count({ where: { code } }) > 0);

    do {
      drivingSchoolCode = `DS${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    } while (await this.schoolRepo.count({ where: { drivingSchoolCode } }) > 0);

    return { code, drivingSchoolCode };
  }

  private async buildAuthPayload(user: User) {
    const payload: Record<string, any> = { sub: user.id, role: user.role };
    if (user.schoolId != null) {
      payload.schoolId = user.schoolId;
    }
    if ((user as any).isManager !== undefined) {
      payload.isManager = Boolean((user as any).isManager);
    }
    const token = await this.jwt.signAsync(payload);

    const userDto: Record<string, any> = {
      id: String(user.id),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      birthDate: user.birthDate ? dayjs(user.birthDate).toISOString() : null,
      role: user.role,
      isManager: Boolean((user as any).isManager),
      phone: user.phone ?? null,
      schoolId: user.schoolId != null ? String(user.schoolId) : null,
      pendingSchoolCode: user.pendingSchoolCode ?? null,
      createdAt: (user as any).createdAt
        ? dayjs((user as any).createdAt).toISOString()
        : null,
      updatedAt: (user as any).updatedAt
        ? dayjs((user as any).updatedAt).toISOString()
        : null,
    };

    if (user.school) {
      userDto.school = {
        id: String(user.school.id),
        name: user.school.name,
        code: user.school.code,
        drivingSchoolCode: user.school.drivingSchoolCode,
        logoUrl: user.school.logoUrl ?? null,
        bannerUrl: user.school.bannerUrl ?? null,
      };
    }

    return { token, user: userDto };
  }
}
