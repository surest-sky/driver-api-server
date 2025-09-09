import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invite, InviteStatus } from './invite.entity';
import { MessagesService } from '../messages/messages.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(Invite) private readonly repo: Repository<Invite>,
    private readonly messages: MessagesService,
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
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      usedAt: null,
    });
    const saved = await this.repo.save(record);

    const conv = await this.messages.getOrCreateConversation(student.id, student.name, coach.id, coach.name);
    await this.messages.sendMessage({
      conversationId: (conv as any).id,
      senderId: coach.id,
      senderName: coach.name,
      receiverId: student.id,
      receiverName: student.name,
      content: `教练 ${coach.name} 向你发起了邀约，邀请码：${saved.code}`,
    });
    return saved;
  }

  private _genCode() {
    const dict = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += dict[Math.floor(Math.random() * dict.length)];
    return s;
  }
}
