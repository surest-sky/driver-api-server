import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Invite, InviteStatus } from './invite.entity';
import { ChatService } from '../messages/chat.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import {
  RelationStatus,
  StudentCoachRelation,
} from '../users/student-coach-relation.entity';
import { School } from '../schools/school.entity';

const NEVER_EXPIRES_AT = new Date('2099-12-31T23:59:59.000Z');

@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(Invite) private readonly repo: Repository<Invite>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(StudentCoachRelation)
    private readonly relationRepo: Repository<StudentCoachRelation>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    private readonly chat: ChatService,
    private readonly users: UsersService,
  ) {}

  listForCoach(coachId: string) {
    return this.repo.find({ where: { inviterId: Number(coachId) }, order: { createdAt: 'DESC' } });
  }

  async getStatus(coachId: string, studentId: string) {
    const student = await this.users.findById(+studentId);
    if (!student) return null;
    const r = await this.repo.findOne({ where: { inviterId: Number(coachId), inviteeEmail: student.email }, order: { createdAt: 'DESC' } });
    return r?.status ?? null;
  }

  async invite(coachId: string, studentId: string) {
    const coach = await this.users.findById(+coachId);
    const student = await this.users.findById(+studentId);
    if (!coach || !student) throw new Error('User not found');
    if (!coach.schoolId) throw new Error('Coach has no schoolId');

    const record = this.repo.create({
      code: this._genCode(),
      inviterId: coach.id,
      inviteeEmail: student.email,
      schoolId: coach.schoolId,
      role: 'student',
      status: InviteStatus.pending,
      expiresAt: NEVER_EXPIRES_AT,
      usedAt: null,
    });
    const saved = await this.repo.save(record);

    // 发送邀约消息
    await this.chat.sendMessage({
      coachId: coach.id,
      studentId: student.id,
      senderId: coach.id,
      senderName: coach.name,
      content: `Coach ${coach.name} has sent you an invitation, code: ${saved.code}`,
    });

    return saved;
  }

  async resolveForUser(userId: string, rawCode: string) {
    const code = this.normalizeCode(rawCode);
    const user = await this.requireUser(userId);
    const invite = await this.requireInvite(code);
    const coach = await this.getInviter(invite.inviterId);
    const school = await this.getSchool(invite.schoolId);

    let conflictReason: string | null = null;
    if (user.schoolId != null) {
      conflictReason = 'ACCOUNT_ALREADY_BOUND';
    }

    return {
      valid: conflictReason == null,
      code,
      schoolName: school?.name ?? '',
      coachName: coach?.name ?? '',
      maskedEmail: this.maskEmail(invite.inviteeEmail),
      expiresAt: invite.expiresAt,
      alreadyAccepted: false,
      conflictReason,
      canAccept: conflictReason == null,
    };
  }

  async acceptForUser(userId: string, rawCode: string) {
    const code = this.normalizeCode(rawCode);
    const invite = await this.requireInvite(code);
    const user = await this.requireUser(userId);

    const result = await this.repo.manager.transaction(async (manager) => {
      const inviteRepo = manager.getRepository(Invite);
      const userRepo = manager.getRepository(User);
      const relationRepo = manager.getRepository(StudentCoachRelation);

      const lockedInvite = await inviteRepo.findOne({
        where: { id: invite.id },
      });
      if (!lockedInvite) {
        throw new BadRequestException('Invite not found');
      }

      const currentUser = await userRepo.findOne({
        where: { id: user.id, deletedAt: IsNull() },
      });
      if (!currentUser) {
        throw new BadRequestException('User not found');
      }

      if (currentUser.schoolId != null) {
        throw new ConflictException('Account already linked');
      }

      await userRepo.update(
        { id: currentUser.id },
        { schoolId: lockedInvite.schoolId, pendingSchoolCode: null },
      );

      if (lockedInvite.inviterId) {
        const relation = await relationRepo.findOne({
          where: {
            studentId: currentUser.id,
            coachId: lockedInvite.inviterId,
          },
        });
        if (relation) {
          relation.status = RelationStatus.active;
          await relationRepo.save(relation);
        } else {
          await relationRepo.save(
            relationRepo.create({
              studentId: currentUser.id,
              coachId: lockedInvite.inviterId,
              status: RelationStatus.active,
            }),
          );
        }
      }

      lockedInvite.status = InviteStatus.accepted;
      if (!lockedInvite.usedAt) {
        lockedInvite.usedAt = new Date();
      }
      await inviteRepo.save(lockedInvite);

      const updatedUser = await userRepo.findOne({
        where: { id: currentUser.id, deletedAt: IsNull() },
        relations: ['school'],
      });

      return {
        invite: lockedInvite,
        user: updatedUser,
        relationCoachId: lockedInvite.inviterId,
        alreadyAccepted: false,
      };
    });

    const coach = await this.getInviter(result.relationCoachId ?? null);
    const school = await this.getSchool(result.user?.schoolId ?? null);

    return {
      ok: true,
      alreadyAccepted: result.alreadyAccepted,
      schoolName: school?.name ?? '',
      coachName: coach?.name ?? '',
      user: this.toUserDto(result.user),
    };
  }

  private _genCode() {
    const dict = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += dict[Math.floor(Math.random() * dict.length)];
    return s;
  }

  private normalizeCode(rawCode: string) {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('Invite code is required');
    }
    return code;
  }

  private async requireUser(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: Number(userId), deletedAt: IsNull() },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  private async requireInvite(code: string) {
    const invite = await this.repo.findOne({ where: { code } });
    if (!invite) {
      throw new BadRequestException('Invite code is invalid');
    }
    return invite;
  }

  private async getInviter(inviterId: number | null) {
    if (!inviterId) return null;
    return this.userRepo.findOne({
      where: { id: inviterId, deletedAt: IsNull() },
    });
  }

  private async getSchool(schoolId: number | null) {
    if (!schoolId) return null;
    return this.schoolRepo.findOne({ where: { id: schoolId } });
  }

  private maskEmail(email: string) {
    const [name, domain] = email.split('@');
    if (!name || !domain) return email;
    if (name.length <= 2) return `${name[0] ?? '*'}*@${domain}`;
    return `${name.slice(0, 2)}***@${domain}`;
  }

  private toUserDto(user: User | null) {
    if (!user) return null;
    return {
      id: String(user.id),
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId != null ? String(user.schoolId) : null,
      pendingSchoolCode: user.pendingSchoolCode ?? null,
      school: user.school
        ? {
            id: String(user.school.id),
            name: user.school.name,
            code: user.school.code,
            drivingSchoolCode: user.school.drivingSchoolCode,
            logoUrl: user.school.logoUrl ?? null,
            bannerUrl: user.school.bannerUrl ?? null,
          }
        : null,
    };
  }
}
