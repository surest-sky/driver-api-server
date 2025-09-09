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
    return this.repo.find({ where: { coachId }, order: { updatedAt: 'DESC' } });
  }

  async getStatus(coachId: string, studentId: string) {
    const r = await this.repo.findOne({ where: { coachId, studentId } });
    return r?.status;
  }

  async invite(coachId: string, studentId: string) {
    const coach = await this.users.findById(coachId);
    const student = await this.users.findById(studentId);
    if (!coach || !student) throw new Error('User not found');

    let record = await this.repo.findOne({ where: { coachId, studentId } });
    if (!record) {
      record = this.repo.create({ coachId, studentId, status: InviteStatus.pending });
    } else {
      record.status = InviteStatus.pending;
    }
    record = await this.repo.save(record);

    const conv = await this.messages.getOrCreateConversation(student.id, student.name, coach.id, coach.name);
    await this.messages.sendMessage({
      conversationId: conv.id,
      senderId: coach.id,
      senderName: coach.name,
      receiverId: student.id,
      receiverName: student.name,
      content: `教练 ${coach.name} 向你发起了邀约，状态：邀约中`,
    });
    return record;
  }
}

