import { Body, Controller, Get, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public, Roles } from '../auth/auth.guard.js';
import type { JwtPayload } from '../auth/jwt.js';
import { AnalyticsService } from './analytics.service.js';
import type {
  AnalyticsRangeDto, CollectAnalyticsDto, LinkVisitorDto, PrivacyRequestDto, RecordConsentDto,
} from './analytics.dto.js';

type AuthRequest = Request & { user?: JwtPayload };

@ApiTags('analytics')
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly service: AnalyticsService) {}

  @Post('collect')
  @Public()
  @ApiOperation({ summary: 'Consent-gated first-party browser event collector' })
  collect(@Body() body: CollectAnalyticsDto, @Req() request: Request) {
    return this.service.collect(body, {
      countryCode: request.header('cf-ipcountry'),
      regionCode: request.header('cf-region-code'),
      userAgent: request.header('user-agent'),
    });
  }

  @Post('consent')
  @Public()
  @ApiOperation({ summary: 'Append consent evidence, including an all-denied decision' })
  recordConsent(@Body() body: RecordConsentDto) {
    return this.service.recordConsent(body.visitorId, body.consent);
  }

  @Post('identity/link')
  @Roles('customer', 'admin')
  link(@Body() body: LinkVisitorDto, @Req() request: AuthRequest) {
    return this.service.link(body.visitorId, request.user!.sub, body.method);
  }

  @Post('privacy')
  @Roles('customer', 'admin')
  privacy(@Body() body: PrivacyRequestDto, @Req() request: AuthRequest) {
    return this.service.requestPrivacy(body.type, request.user!.sub, body.visitorId);
  }

  @Get('admin/overview')
  @Roles('admin')
  overview(@Query() query: AnalyticsRangeDto) {
    return this.service.overview(query.from, query.to);
  }

  @Get('admin/visitors')
  @Roles('admin')
  visitors(@Query() query: AnalyticsRangeDto) {
    return this.service.visitors(Number(query.limit ?? 50), query.cursor);
  }

  @Get('admin/visitors/:id/journey')
  @Roles('admin')
  journey(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.service.journey(id, Number(limit ?? 100));
  }

  @Get('admin/visitors/:id')
  @Roles('admin')
  visitor(@Param('id') id: string) {
    return this.service.visitorDetail(id);
  }

  @Get('admin/visitors/:id/export')
  @Roles('admin')
  exportVisitor(@Param('id') id: string) {
    return this.service.exportVisitor(id);
  }

  @Get('admin/search')
  @Roles('admin')
  search(@Query() query: AnalyticsRangeDto) {
    return this.service.searchIntelligence(query.from, query.to);
  }

  @Get('admin/consent')
  @Roles('admin')
  consent(@Query() query: AnalyticsRangeDto) {
    return this.service.consentOverview(query.from, query.to);
  }

  @Get('admin/catalogue')
  @Roles('admin')
  catalogue(@Query() query: AnalyticsRangeDto) {
    return this.service.catalogueOverview(query.from, query.to);
  }

  @Get('admin/funnel')
  @Roles('admin')
  funnel(@Query('steps') steps: string, @Query() query: AnalyticsRangeDto) {
    return this.service.funnel((steps ?? '').split(','), query.from, query.to);
  }

  @Get('admin/cohorts')
  @Roles('admin')
  cohorts(@Query() query: AnalyticsRangeDto) {
    return this.service.cohorts(query.from, query.to);
  }

  @Post('admin/aggregate/run')
  @Roles('admin', 'service')
  aggregate() {
    return this.service.aggregateDay();
  }

  @Post('admin/retention/run')
  @Roles('admin', 'service')
  retention() {
    return this.service.runRetention();
  }
}
