import { Global, Module } from '@nestjs/common';
import { TypesenseService } from './typesense.service.js';
import { SemanticSearchService } from './semantic-search.service.js';
import { ProductIndexerService } from './product-indexer.service.js';

@Global()
@Module({
  providers: [TypesenseService, SemanticSearchService, ProductIndexerService],
  exports: [TypesenseService, SemanticSearchService, ProductIndexerService],
})
export class SearchModule {}
