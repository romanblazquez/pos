import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.guard.js';

/** Liveness / readiness probes for orchestration and load balancers. */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  live(): { status: string; at: string } {
    return { status: 'ok', at: new Date().toISOString() };
  }

  @Get('ready')
  ready(): { ready: boolean } {
    // Roadmap: check DB connectivity / migrations applied.
    return { ready: true };
  }
}
