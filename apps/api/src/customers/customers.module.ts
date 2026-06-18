import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller.js';
import { CustomerAddressService } from './customer-address.service.js';

@Module({
  controllers: [CustomersController],
  providers: [CustomerAddressService],
  exports: [CustomerAddressService],
})
export class CustomersModule {}
