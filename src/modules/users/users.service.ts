import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { StudentCoachRelation, RelationStatus } from './student-coach-relation.entity';
import { School } from '../schools/school.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(StudentCoachRelation) private readonly relationRepo: Repository<StudentCoachRelation>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>
  ) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email }, relations: ['school'] });
  }

  findById(id: number) {
    return this.repo.findOne({ where: { id }, relations: ['school'] });
  }

  async createUser(data: Partial<User>) {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  async updateUser(id: number, patch: Partial<User>) {
    await this.repo.update({ id }, patch);
    return this.findById(id);
  }

  async listCoachesBySchool(schoolId: number, page: number, pageSize: number, q?: string) {
    const qb = this.repo.createQueryBuilder('u')
      .where('u.role = :role', { role: UserRole.coach })
      .andWhere('u.schoolId = :schoolId', { schoolId })
      .orderBy('u.isManager', 'DESC')
      .addOrderBy('u.updatedAt', 'DESC');
    if (q && q.trim()) {
      qb.andWhere('(u.name LIKE :q OR u.email LIKE :q)', { q: `%${q.trim()}%` });
    }
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findCoachById(id: number) {
    return this.repo.findOne({ where: { id, role: UserRole.coach }, relations: ['school'] });
  }

  async setManagerForSchool(schoolId: number, coachId: number) {
    await this.repo.createQueryBuilder()
      .update(User)
      .set({ isManager: false })
      .where('schoolId = :schoolId AND role = :role', { schoolId, role: UserRole.coach })
      .execute();
    await this.repo.update({ id: coachId }, { isManager: true });
    return this.findCoachById(coachId);
  }

  async findCoachBySchoolId(schoolId: number) {
    return this.repo.findOne({
      where: {
        role: UserRole.coach,
        schoolId: schoolId
      }
    });
  }

  async getCoachForStudent(studentId: number) {
    const relation = await this.relationRepo.findOne({
      where: { studentId, status: RelationStatus.active },
      relations: ['coach']
    });
    return relation?.coach;
  }

  async assignStudentToCoach(studentId: number, coachId: number) {
    // 检查是否已存在关系
    const existing = await this.relationRepo.findOne({
      where: { studentId, coachId }
    });

    if (existing) {
      existing.status = RelationStatus.active;
      return this.relationRepo.save(existing);
    }

    const relation = this.relationRepo.create({
      studentId,
      coachId,
      status: RelationStatus.active
    });

    return this.relationRepo.save(relation);
  }

  async updateCoach(coachId: number, patch: Partial<User>) {
    await this.repo.update({ id: coachId, role: UserRole.coach }, patch);
    return this.findCoachById(coachId);
  }

  async listStudentsBySchool(schoolId: number, page: number, pageSize: number, q?: string) {
    const qb = this.repo
      .createQueryBuilder('u')
      .where('u.role = :role', { role: UserRole.student })
      .andWhere('u.schoolId = :schoolId', { schoolId })
      .orderBy('u.updatedAt', 'DESC');

    if (q && q.trim()) {
      qb.andWhere('(u.name LIKE :q OR u.email LIKE :q)', { q: `%${q.trim()}%` });
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async bindSchoolToUser(userId: number, drivingSchoolCode: string) {
    // 查找学校
    const school = await this.schoolRepo.findOne({
      where: { drivingSchoolCode: drivingSchoolCode.trim().toUpperCase() }
    });

    if (!school) {
      throw new BadRequestException('驾校代码不存在');
    }

    // 更新用户的学校绑定
    await this.repo.update({ id: userId }, {
      schoolId: school.id,
      pendingSchoolCode: null  // 清除待定学校代码
    });

    // 返回更新后的用户信息（包含学校关联）
    return this.findById(userId);
  }
}
