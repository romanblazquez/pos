import { Global, Module } from '@nestjs/common';
import { TypesenseService } from './typesense.service.js';
import { SemanticSearchService } from './semantic-search.service.js';

@Global()
@Module({
  providers: [TypesenseService, SemanticSearchService],
  exports: [TypesenseService, SemanticSearchService],
})
export class SearchModule {}
