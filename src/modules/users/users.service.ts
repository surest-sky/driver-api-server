import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { StudentCoachRelation } from './student-coach-relation.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(StudentCoachRelation) private readonly relationRepo: Repository<StudentCoachRelation>
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

  async listStudentsBySchool(schoolId: number, page: number, pageSize: number, q?: string) {
    const qb = this.repo.createQueryBuilder('u')
      .where('u.role = :role', { role: UserRole.student })
      .andWhere('u.schoolId = :schoolId', { schoolId })
      .orderBy('u.name', 'ASC');
    if (q && q.trim()) {
      qb.andWhere('(u.name LIKE :q OR u.email LIKE :q)', { q: `%${q.trim()}%` });
    }
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
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
      where: { studentId, status: 'active' },
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
      existing.status = 'active' as any;
      return this.relationRepo.save(existing);
    }
    
    const relation = this.relationRepo.create({
      studentId,
      coachId,
      status: 'active' as any
    });
    
    return this.relationRepo.save(relation);
  }
}

