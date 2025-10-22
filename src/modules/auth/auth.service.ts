import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as dayjs from "dayjs";
import { User, UserRole } from "../users/user.entity";
import { School } from "../schools/school.entity";

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
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    private readonly jwt: JwtService
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
    const payload = { sub: user.id, role: user.role };
    const token = await this.jwt.signAsync(payload);

    const userDto: Record<string, any> = {
      id: String(user.id),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      birthDate: user.birthDate ? dayjs(user.birthDate).toISOString() : null,
      role: user.role,
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
