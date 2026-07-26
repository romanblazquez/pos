import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, Roles } from '../auth/auth.guard.js';
import { EditorialService } from './editorial.service.js';

@ApiTags('editorial')
@Controller('api/v1/editorial')
export class EditorialController {
  constructor(@Inject(EditorialService) private readonly service: EditorialService) {}

  @Get('guides')
  @Public()
  @ApiOperation({ summary: 'Published localized editorial guides' })
  guides(@Query('locale') locale?: string) {
    return this.service.publishedGuides(locale ?? 'es');
  }

  @Get('guides/:slug')
  @Public()
  @ApiOperation({ summary: 'One published localized editorial guide' })
  guide(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.service.publishedGuide(slug, locale ?? 'es');
  }

  @Get('authors')
  @Public()
  @ApiOperation({ summary: 'Active editorial author profiles' })
  authors(@Query('locale') locale?: string) {
    return this.service.authors(locale);
  }

  @Get('admin/articles')
  @Roles('admin')
  @ApiOperation({ summary: 'Editorial publication and review status' })
  adminArticles() {
    return this.service.adminArticles();
  }
}
