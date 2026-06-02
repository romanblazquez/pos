import { Body, Controller, Get, Post, Param } from '@nestjs/common';
import type { WizardState } from '@retail-os/onboarding';

/**
 * OnboardingController — persists and retrieves onboarding wizard progress
 * on the central API. The local shell also stores state in SQLite so the wizard
 * works offline; this endpoint synchronizes it after connectivity is restored.
 */
@Controller('onboarding')
export class OnboardingController {
  // TODO(production): inject OnboardingRepository (Prisma) here.
  private readonly states = new Map<string, WizardState>();

  @Get(':tenantId')
  getState(@Param('tenantId') tenantId: string): WizardState | { notFound: true } {
    return this.states.get(tenantId) ?? { notFound: true };
  }

  @Post(':tenantId')
  saveState(
    @Param('tenantId') tenantId: string,
    @Body() state: WizardState,
  ): { ok: boolean } {
    this.states.set(tenantId, { ...state });
    return { ok: true };
  }

  @Post(':tenantId/complete')
  complete(@Param('tenantId') tenantId: string): { completed: boolean } {
    const state = this.states.get(tenantId);
    if (state) {
      state.completedAt = new Date().toISOString();
      this.states.set(tenantId, state);
    }
    return { completed: !!state };
  }
}
