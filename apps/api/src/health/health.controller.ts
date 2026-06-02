import { Controller, Get } from '@nestjs/common';

/** Liveness / readiness probes for orchestration and load balancers. */
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
