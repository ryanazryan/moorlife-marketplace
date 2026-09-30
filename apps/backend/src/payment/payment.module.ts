import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentSubmissionController } from './payment-submission.controller';
import { PaymentService } from './payment.service';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PaymentExpirationService } from './payment-expiration.service';

@Module({
  imports: [
    SessionsModule,
    UsersModule,
    CloudinaryModule,
  ],
  controllers: [
    PaymentController,
    PaymentSubmissionController,
  ],
  providers: [PaymentService, PaymentExpirationService],
  exports: [PaymentService],
})
export class PaymentModule {}