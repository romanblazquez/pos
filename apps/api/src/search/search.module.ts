import { Global, Module } from '@nestjs/common';
import { TypesenseService } from './typesense.service.js';

@Global()
@Module({
  providers: [TypesenseService],
  exports: [TypesenseService],
})
export class SearchModule {}
