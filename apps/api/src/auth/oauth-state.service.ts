import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';

function hashState(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}

@Injectable()
export class OAuthStateService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(provider: string, ownerId: string, codeVerifier?: string): Promise<string> {
    await this.prisma.oAuthTransaction.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    const state = randomBytes(32).toString('base64url');
    await this.prisma.oAuthTransaction.create({
      data: {
        provider,
        ownerId,
        stateHash: hashState(state),
        codeVerifier,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    return state;
  }

  async consume(provider: string, ownerId: string, state: string) {
    const transaction = await this.prisma.oAuthTransaction.findUnique({
      where: { stateHash: hashState(state) },
    });
    if (!transaction || transaction.provider !== provider || transaction.ownerId !== ownerId
      || transaction.consumedAt || transaction.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
    const consumed = await this.prisma.oAuthTransaction.updateMany({
      where: { id: transaction.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new UnauthorizedException('OAuth state was already used');
    return transaction;
  }

  async consumeByState(provider: string, state: string) {
    const transaction = await this.prisma.oAuthTransaction.findUnique({
      where: { stateHash: hashState(state) },
    });
    if (!transaction) throw new UnauthorizedException('Invalid OAuth state');
    return this.consume(provider, transaction.ownerId, state);
  }
}
