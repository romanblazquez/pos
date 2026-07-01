import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { DEFAULT_COUNTRY_CODE } from '../markets/default-market.constants.js';

export interface AddressInput {
  label?: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

@Injectable()
export class CustomerAddressService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(customerId: string) {
    return this.prisma.mktAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });
  }

  private async getOwned(customerId: string, addressId: string) {
    const address = await this.prisma.mktAddress.findUnique({ where: { id: addressId } });
    if (!address || address.customerId !== customerId) {
      throw new NotFoundException(`Address ${addressId} not found for this customer`);
    }
    return address;
  }

  /** Creating the first address for a customer makes it the default automatically. */
  async create(customerId: string, input: AddressInput) {
    const existingCount = await this.prisma.mktAddress.count({ where: { customerId } });
    const makeDefault = input.isDefault ?? existingCount === 0;

    if (makeDefault) {
      await this.prisma.mktAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
    }

    return this.prisma.mktAddress.create({
      data: {
        customerId,
        label: input.label,
        street: input.street,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: input.country ?? DEFAULT_COUNTRY_CODE,
        isDefault: makeDefault,
      },
    });
  }

  async update(customerId: string, addressId: string, input: Partial<AddressInput>) {
    await this.getOwned(customerId, addressId);

    if (input.isDefault) {
      await this.prisma.mktAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
    }

    return this.prisma.mktAddress.update({
      where: { id: addressId },
      data: input,
    });
  }

  async delete(customerId: string, addressId: string) {
    const address = await this.getOwned(customerId, addressId);
    await this.prisma.mktAddress.delete({ where: { id: addressId } });

    // If the deleted address was the default and others remain, promote the next one.
    if (address.isDefault) {
      const next = await this.prisma.mktAddress.findFirst({ where: { customerId } });
      if (next) await this.prisma.mktAddress.update({ where: { id: next.id }, data: { isDefault: true } });
    }

    return { ok: true };
  }
}
