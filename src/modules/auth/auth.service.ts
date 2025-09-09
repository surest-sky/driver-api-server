import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { User } from "../users/user.entity";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly jwt: JwtService
  ) {}

  async login(email: string, password: string) {
    const user = await this.repo.findOne({ where: { email } });
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

    const payload = { sub: user.id, role: user.role };
    const token = await this.jwt.signAsync(payload);

    // 返回前端友好的 User DTO：
    // - 避免泄露 passwordHash
    // - 将数值型 ID 转成字符串，兼容前端期望类型
    // - 将日期转成 ISO 字符串
    const userDto = {
      id: String(user.id),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      birthDate: user.birthDate ? user.birthDate.toISOString() : null,
      role: user.role,
      schoolId: user.schoolId != null ? String(user.schoolId) : null,
      createdAt: (user as any).createdAt
        ? new Date((user as any).createdAt).toISOString()
        : null,
      updatedAt: (user as any).updatedAt
        ? new Date((user as any).updatedAt).toISOString()
        : null,
    };

    return { token, user: userDto };
  }
}
