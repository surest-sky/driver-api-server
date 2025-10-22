import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppUpdate } from './app-update.entity';
import { AppUpdatesController } from './app-updates.controller';
import { AppUpdatesService } from './app-updates.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppUpdate])],
  controllers: [AppUpdatesController],
  providers: [AppUpdatesService],
  exports: [AppUpdatesService],
})
export class AppUpdatesModule {}
