import { Module } from '@nestjs/common';
import { EditorialController } from './editorial.controller.js';
import { EditorialService } from './editorial.service.js';

@Module({
  controllers: [EditorialController],
  providers: [EditorialService],
})
export class EditorialModule {}
