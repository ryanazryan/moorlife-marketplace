import { Module } from '@nestjs/common';
import { CustomerModule } from './customer/customer.module';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { RATE_LIMIT_WINDOW_MS } from './config/rate-limit.config';
import { PrismaModule } from './prisma/prisma.module';
import { cloudinaryConfig } from './config/cloudinary.config';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { ProductModule } from './product/product.module';
import { BrandModule } from './brand/brand.module';
import { SupplierModule } from './supplier/supplier.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { OrdersModule } from './orders/orders.module';
import { PricingModule } from './pricing/pricing.module';
import { CartModule } from './cart/cart.module';
import { shippingConfig } from './config/shipping.config';
import { ShippingModule } from './shipping/shipping.module';
import { CheckoutModule } from './checkout/checkout.module';
import { PaymentModule } from './payment/payment.module';
import paymentConfig from './config/payment.config';
import { AdminModule } from './admin/admin.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [cloudinaryConfig, shippingConfig, paymentConfig],
    }),

    ScheduleModule.forRoot(),

    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: RATE_LIMIT_WINDOW_MS,
        limit: 100,
      },
    ]),

    PrismaModule,
    AuthModule,
    CustomerModule,
    CloudinaryModule,
    ProductModule,
    BrandModule,
    SupplierModule,
    WishlistModule,
    OrdersModule,
    PricingModule,
    CartModule,
    ShippingModule,
    CheckoutModule,
    PaymentModule,
    AdminModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
