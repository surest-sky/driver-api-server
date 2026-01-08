import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { StudentCoachRelation, RelationStatus } from './student-coach-relation.entity';
import { School } from '../schools/school.entity';
import { CreditRecord } from './credit-record.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(StudentCoachRelation) private readonly relationRepo: Repository<StudentCoachRelation>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    @InjectRepository(CreditRecord) private readonly creditRecordRepo: Repository<CreditRecord>
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

  findSchoolById(id: number) {
    return this.schoolRepo.findOne({ where: { id } });
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

  async unbindStudentFromSchool(studentId: number, schoolId: number) {
    const student = await this.repo.findOne({
      where: { id: studentId, role: UserRole.student },
    });
    if (!student) {
      throw new BadRequestException('学员不存在');
    }
    if (!student.schoolId || student.schoolId !== schoolId) {
      throw new BadRequestException('学员不属于当前学校');
    }
    await this.repo.update(
      { id: studentId },
      { schoolId: null, pendingSchoolCode: null },
    );
    return this.findById(studentId);
  }

  async getCreditRecords(studentId: number, page: number, pageSize: number) {
    const qb = this.creditRecordRepo
      .createQueryBuilder('cr')
      .leftJoinAndSelect('cr.coach', 'coach')
      .where('cr.studentId = :studentId', { studentId })
      .orderBy('cr.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    // 格式化返回数据
    const formattedItems = items.map(record => ({
      id: record.id.toString(),
      studentId: record.studentId.toString(),
      coachId: record.coachId.toString(),
      coachName: record.coach?.name || '未知教练',
      delta: record.delta,
      description: record.description,
      balanceAfter: record.balanceAfter,
      createdAt: record.createdAt,
    }));

    return { items: formattedItems, total };
  }

  async adjustCredits(
    studentId: number,
    coachId: number,
    delta: number,
    description: string,
  ) {
    // 获取学员当前积分
    const student = await this.repo.findOne({ where: { id: studentId } });
    if (!student) {
      throw new BadRequestException('学员不存在');
    }

    const currentCredits = student.credits || 0;
    const newBalance = currentCredits + delta;

    // 检查积分是否足够
    if (newBalance < 0) {
      throw new BadRequestException('积分不足');
    }

    // 获取教练名称
    const coach = await this.repo.findOne({ where: { id: coachId } });
    const coachName = coach?.name || '未知教练';

    // 创建积分记录
    const record = this.creditRecordRepo.create({
      studentId,
      coachId,
      delta,
      description,
      balanceAfter: newBalance,
      createdAt: new Date(),
    });

    await this.creditRecordRepo.save(record);

    // 更新学员积分
    await this.repo.update({ id: studentId }, { credits: newBalance });

    // 返回带教练信息的记录
    const savedRecord = await this.creditRecordRepo
      .createQueryBuilder('cr')
      .leftJoinAndSelect('cr.coach', 'coach')
      .where('cr.id = :id', { id: record.id })
      .getOne();

    return {
      id: savedRecord!.id.toString(),
      studentId: savedRecord!.studentId.toString(),
      coachId: savedRecord!.coachId.toString(),
      coachName: coachName,
      delta: savedRecord!.delta,
      description: savedRecord!.description,
      balanceAfter: savedRecord!.balanceAfter,
      createdAt: savedRecord!.createdAt,
    };
  }
}
