import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from './school.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School) private readonly repo: Repository<School>,
    private readonly users: UsersService,
  ) {}

  async getForCoach(coachId: string) {
    const coach = await this.users.findById(+coachId);
    if (!coach?.school) {
      throw new Error('Coach school not found');
    }
    const school = coach.school;
    
    // 转换字段名以匹配前端模型
    return {
      ...school,
      backgroundImageUrl: school.bannerUrl, // 前端期望 backgroundImageUrl
    };
  }

  async updateForCoach(coachId: string, patch: any) {
    const s = await this.getForCoach(coachId) as any;
    const updateData: Partial<School> = {
      ...patch,
    };
    await this.repo.update({ id: s.id }, updateData);
    const updated = await this.repo.findOne({ where: { id: s.id } });
    return {
      ...updated,
      backgroundImageUrl: updated?.bannerUrl,
    };
  }

  async getOverviewForStudent(studentId: number) {
    const student = await this.users.findById(studentId);
    if (!student?.schoolId) {
      throw new BadRequestException('当前学员尚未绑定学校');
    }
    const school = await this.repo.findOne({ where: { id: student.schoolId } });
    if (!school) {
      throw new BadRequestException('未找到对应的学校信息');
    }
    const { items } = await this.users.listCoachesBySchool(student.schoolId, 1, 200);
    return {
      school: {
        id: school.id,
        name: school.name,
        code: school.code,
        drivingSchoolCode: school.drivingSchoolCode,
        logoUrl: school.logoUrl,
        bannerUrl: school.bannerUrl,
        createdAt: school.createdAt?.toISOString(),
        updatedAt: school.updatedAt?.toISOString(),
      },
      coaches: items.map((coach) => ({
        id: coach.id,
        name: coach.name,
        email: coach.email,
        avatarUrl: coach.avatarUrl,
        isManager: coach.isManager,
        role: coach.role,
        createdAt: coach.createdAt?.toISOString(),
        updatedAt: coach.updatedAt?.toISOString(),
      })),
    };
  }

  findByDrivingSchoolCode(code: string) {
    return this.repo.findOne({ where: { drivingSchoolCode: code } });
  }

  /// 搜索学校
  /// 支持按名称或代码模糊搜索
  async searchSchools(keyword: string, limit = 20) {
    if (!keyword || !keyword.trim()) {
      return [];
    }

    const query = this.repo.createQueryBuilder('school');

    // 支持按名称或代码搜索
    query.where('school.name LIKE :keyword OR school.code LIKE :keyword OR school.driving_school_code LIKE :keyword', {
      keyword: `%${keyword.trim()}%`,
    });

    query.limit(limit);

    return await query.getMany();
  }

  async getRandomSchools(limit = 3) {
    const normalizedLimit = Math.max(1, Math.min(limit, 50));
    return this.repo
      .createQueryBuilder('school')
      .orderBy('RAND()')
      .limit(normalizedLimit)
      .getMany();
  }
}
