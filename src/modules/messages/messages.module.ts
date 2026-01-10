import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesController } from './messages.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { Message } from './message.entity';
import { UsersModule } from '../users/users.module';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Message, User]), UsersModule],
  controllers: [MessagesController],
  providers: [ChatGateway, ChatService],
  exports: [ChatGateway, ChatService],
})
export class MessagesModule {}
