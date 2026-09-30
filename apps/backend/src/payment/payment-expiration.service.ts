import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentExpirationService {
  private readonly logger = new Logger(PaymentExpirationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('*/1 * * * *')
  async handleExpiredPayments() {
    const now = new Date();

    this.logger.log(`Running payment expiration check at ${now.toISOString()}`);

    const expiredPayments = await this.prisma.payment.findMany({
      where: {
        expiresAt: {
          lte: now,
        },
        status: {
          in: ['PENDING', 'PROCESSING'],
        },
        order: {
          status: 'PENDING_PAYMENT',
        },
      },
      select: {
        id: true,
        orderId: true,
      },
      take: 100,
    });

    this.logger.log(`Found ${expiredPayments.length} expired payment(s).`);

    for (const payment of expiredPayments) {
      try {
        await this.expirePayment(payment.id, payment.orderId, now);
      } catch (error) {
        this.logger.error(
          `Failed to expire payment ${payment.id}.`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async expirePayment(paymentId: string, orderId: string, now: Date) {
    await this.prisma.$transaction(async (tx) => {
      const paymentUpdate = await tx.payment.updateMany({
        where: {
          id: paymentId,
          status: {
            in: ['PENDING', 'PROCESSING'],
          },
          expiresAt: {
            lte: now,
          },
          order: {
            status: 'PENDING_PAYMENT',
          },
        },
        data: {
          status: 'EXPIRED',
          expiredAt: now,
        },
      });

      if (paymentUpdate.count !== 1) {
        this.logger.log(
          `Payment ${paymentId} was already processed or is no longer eligible.`,
        );

        return;
      }

      await tx.order.updateMany({
        where: {
          id: orderId,
          status: 'PENDING_PAYMENT',
        },
        data: {
          status: 'CANCELLED',
        },
      });

      const reservations = await tx.stockReservation.findMany({
        where: {
          orderId,
          status: 'RESERVED',
        },
        select: {
          id: true,
          productId: true,
          quantity: true,
        },
      });

      for (const reservation of reservations) {
        const inventory = await tx.inventory.findUnique({
          where: {
            productId: reservation.productId,
          },
          select: {
            id: true,
          },
        });

        if (!inventory) {
          throw new Error(
            `Inventory not found for product ${reservation.productId}.`,
          );
        }

        await tx.inventory.update({
          where: {
            id: inventory.id,
          },
          data: {
            availableQuantity: {
              increment: reservation.quantity,
            },
            reservedQuantity: {
              decrement: reservation.quantity,
            },
          },
        });

        await tx.stockReservation.update({
          where: {
            id: reservation.id,
          },
          data: {
            status: 'RELEASED',
            releasedAt: now,
          },
        });

        await tx.stockMovement.create({
          data: {
            inventoryId: inventory.id,
            type: 'RELEASE',
            quantity: reservation.quantity,
            referenceType: 'ORDER',
            referenceId: orderId,
            reason: 'Reserved stock released after payment expiration.',
          },
        });
      }

      this.logger.log(
        `Payment ${paymentId} expired. Order ${orderId} cancelled. Released ${reservations.length} reservation(s).`,
      );
    });
  }
}
