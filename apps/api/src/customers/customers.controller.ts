import {
  Body, Controller, Delete, Get, Inject, Param, Patch, Post,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse,
} from '@nestjs/swagger';
import { CustomerAddressService } from './customer-address.service.js';
import { Roles } from '../auth/auth.guard.js';

const ADDRESS_BODY_SCHEMA = {
  type: 'object' as const,
  properties: {
    label: { type: 'string', example: 'Casa' },
    street: { type: 'string', example: 'Av. Reforma 123' },
    city: { type: 'string', example: 'Ciudad de México' },
    state: { type: 'string', example: 'CDMX' },
    postalCode: { type: 'string', example: '06600' },
    country: { type: 'string', example: 'MX' },
    isDefault: { type: 'boolean', example: false },
  },
};

@ApiTags('customers')
@Roles('customer', 'admin')
@Controller('api/v1/customers/:customerId/addresses')
export class CustomersController {
  constructor(@Inject(CustomerAddressService) private readonly svc: CustomerAddressService) {}

  @Get()
  @ApiOperation({ summary: "List a customer's saved delivery addresses" })
  @ApiParam({ name: 'customerId', description: 'Customer CUID' })
  list(@Param('customerId') customerId: string) {
    return this.svc.list(customerId);
  }

  @Post()
  @ApiOperation({
    summary: 'Save a new delivery address',
    description: 'The first address saved for a customer automatically becomes the default.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer CUID' })
  @ApiBody({ schema: { ...ADDRESS_BODY_SCHEMA, required: ['street', 'city', 'state', 'postalCode'] } })
  @ApiResponse({ status: 201, description: 'Created address.' })
  create(@Param('customerId') customerId: string, @Body() body: {
    label?: string; street: string; city: string; state: string; postalCode: string; country?: string; isDefault?: boolean;
  }) {
    return this.svc.create(customerId, body);
  }

  @Patch(':addressId')
  @ApiOperation({ summary: 'Update a saved address' })
  @ApiParam({ name: 'customerId', description: 'Customer CUID' })
  @ApiParam({ name: 'addressId', description: 'Address CUID' })
  @ApiBody({ schema: ADDRESS_BODY_SCHEMA })
  update(
    @Param('customerId') customerId: string,
    @Param('addressId') addressId: string,
    @Body() body: Partial<{
      label?: string; street: string; city: string; state: string; postalCode: string; country?: string; isDefault?: boolean;
    }>,
  ) {
    return this.svc.update(customerId, addressId, body);
  }

  @Delete(':addressId')
  @ApiOperation({ summary: 'Delete a saved address' })
  @ApiParam({ name: 'customerId', description: 'Customer CUID' })
  @ApiParam({ name: 'addressId', description: 'Address CUID' })
  delete(@Param('customerId') customerId: string, @Param('addressId') addressId: string) {
    return this.svc.delete(customerId, addressId);
  }
}
