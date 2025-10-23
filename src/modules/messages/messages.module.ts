import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { ChatGateway } from './chat.gateway';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { UsersModule } from '../users/users.module';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, User]), UsersModule],
  controllers: [MessagesController],
  providers: [MessagesService, ChatGateway],
  exports: [MessagesService, ChatGateway],
})
export class MessagesModule {}
