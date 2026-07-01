import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';

// Same point values as the "Ways to earn XP" list on AccountPage.tsx
// (XP_EARN_ACTIONS) — only forward-looking collection actions award XP;
// other statuses (previously-owned, for-trade, preordered, spare-parts)
// aren't in that list, so they don't award XP.
//
// want-to-play and played match the +5 the guest (logged-out) localStorage
// path in ShelfContext.tsx already awards for the same statuses — this used
// to be inconsistent (guests got XP for want-to-play, logged-in customers
// didn't).
const SHELF_XP_AWARDS: Record<string, { amount: number; label: string }> = {
  owned: { amount: 10, label: 'Agregar a colección' },
  wishlist: { amount: 5, label: 'Agregar a wishlist' },
  'want-to-play': { amount: 5, label: 'Marcar como quiero jugar' },
  played: { amount: 5, label: 'Marcar como jugado' },
};

// Fixed award for generic (non-shelf-status) XP events — keyed by
// eventType, same reasoning as SHELF_XP_AWARDS: the client picks an event,
// the server decides the amount.
const XP_EVENT_AWARDS: Record<string, { amount: number; label: string }> = {
  purchase_confirmed: { amount: 60, label: 'Compra completada' },
};

@Injectable()
export class ShelfService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getShelf(customerId: string) {
    const customer = await this.prisma.mktCustomer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);

    const [items, xp] = await Promise.all([
      this.prisma.shelfItem.findMany({
        where: { customerId },
        include: { product: { select: { slug: true, name: true } } },
        orderBy: { addedAt: 'desc' },
      }),
      this.getOrCreateXp(customerId),
    ]);

    return {
      items,
      totalXp: xp.totalXp,
      recentEvents: await this.prisma.xpEvent.findMany({
        where: { customerXpId: xp.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    };
  }

  private async getOrCreateXp(customerId: string) {
    return this.prisma.customerXp.upsert({
      where: { customerId },
      create: { customerId, totalXp: 0 },
      update: {},
    });
  }

  /** Internal — actually applies an XP award in one transaction. */
  private async applyXpAward(customerId: string, amount: number, label: string) {
    await this.prisma.$transaction(async (tx) => {
      const xp = await tx.customerXp.upsert({
        where: { customerId },
        create: { customerId, totalXp: 0 },
        update: {},
      });
      await tx.customerXp.update({
        where: { id: xp.id },
        data: { totalXp: { increment: amount } },
      });
      await tx.xpEvent.create({
        data: { customerXpId: xp.id, label, amount },
      });
    });
  }

  /**
   * Generic XP award for events that aren't a shelf-status change, e.g.
   * "purchase confirmed" triggered from the checkout flow. `eventType` is a
   * fixed lookup key, not a client-supplied amount (see XP_EVENT_AWARDS).
   */
  async awardXpForEvent(customerId: string, eventType: string) {
    const award = XP_EVENT_AWARDS[eventType];
    if (award) await this.applyXpAward(customerId, award.amount, award.label);
    return this.getShelf(customerId);
  }

  /**
   * Set (or clear) a customer's shelf status for a product, awarding XP
   * server-side only the first time a product is genuinely newly marked
   * "owned" or "wishlist" (not on every toggle/no-op call) — the client
   * must not be able to farm XP by re-submitting the same status.
   *
   * Takes a product slug, not id — every call site in apps/marketplace
   * (ProductCard, ShelfButtons) only ever has the slug on hand.
   */
  async setStatus(customerId: string, productSlug: string, status: string | null) {
    const product = await this.prisma.mktProduct.findUnique({ where: { slug: productSlug } });
    if (!product) throw new NotFoundException(`Product "${productSlug}" not found`);
    const productId = product.id;

    const existing = await this.prisma.shelfItem.findUnique({
      where: { customerId_productId: { customerId, productId } },
    });

    const isNewAward = status
      && SHELF_XP_AWARDS[status]
      && existing?.status !== status;

    if (status === null) {
      if (existing) await this.prisma.shelfItem.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.shelfItem.upsert({
        where: { customerId_productId: { customerId, productId } },
        create: { customerId, productId, status },
        update: { status },
      });
    }

    if (isNewAward) {
      const award = SHELF_XP_AWARDS[status as string];
      await this.applyXpAward(customerId, award.amount, award.label);
    }

    return this.getShelf(customerId);
  }

  /** Bulk-import a guest's localStorage shelf on first login — never re-awards XP for items the customer already has. */
  async importGuestShelf(customerId: string, items: { slug: string; status: string }[]) {
    for (const item of items) {
      const product = await this.prisma.mktProduct.findUnique({ where: { slug: item.slug } });
      if (!product) continue;
      await this.setStatus(customerId, item.slug, item.status);
    }
    return this.getShelf(customerId);
  }
}
