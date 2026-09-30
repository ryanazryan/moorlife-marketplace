import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  async addToCart(userId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        price: true,
        inventory: {
          select: {
            availableQuantity: true,
          },
        },
        brand: {
          select: {
            name: true,
            slug: true,
          },
        },
        media: {
          orderBy: {
            sortOrder: 'asc',
          },
          take: 1,
          select: {
            url: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    const cart = await this.prisma.cart.upsert({
      where: {
        userId,
      },
      update: {},
      create: {
        userId,
      },
    });

    const existingCartItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    const resultingQuantity = existingCartItem
      ? existingCartItem.quantity + quantity
      : quantity;

    if (!product.inventory) {
      throw new BadRequestException('Product inventory not found.');
    }

    if (resultingQuantity > product.inventory.availableQuantity) {
      throw new BadRequestException(
        `Insufficient stock. Available quantity: ${product.inventory.availableQuantity}.`,
      );
    }

    const cartItem = existingCartItem
      ? await this.prisma.cartItem.update({
          where: {
            id: existingCartItem.id,
          },
          data: {
            quantity: resultingQuantity,
          },
          include: {
            product: {
              include: {
                brand: true,
                media: {
                  orderBy: {
                    sortOrder: 'asc',
                  },
                  take: 1,
                },
              },
            },
          },
        })
      : await this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            quantity,
            isSelected: true,
          },
          include: {
            product: {
              include: {
                brand: true,
                media: {
                  orderBy: {
                    sortOrder: 'asc',
                  },
                  take: 1,
                },
              },
            },
          },
        });

    const pricing = await this.pricingService.getProductPrice(
      userId,
      productId,
    );

    const subtotal = pricing.finalPrice * cartItem.quantity;

    return {
      cartItemId: cartItem.id,
      product: {
        id: cartItem.product.id,
        name: cartItem.product.name,
        brand: cartItem.product.brand.name,
        imageUrl: cartItem.product.media[0]?.url ?? null,
      },
      quantity: cartItem.quantity,
      isSelected: cartItem.isSelected,
      pricing: {
        originalPrice: pricing.originalPrice,
        finalPrice: pricing.finalPrice,
        discountPercentage: pricing.discountPercentage,
        isMemberDiscountApplicable: pricing.isMemberDiscountApplicable,
      },
      subtotal,
    };
  }

  async getMyCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: {
        userId,
      },
      include: {
        items: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                brand: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
                media: {
                  orderBy: {
                    sortOrder: 'asc',
                  },
                  take: 1,
                  select: {
                    url: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      return {
        cartId: null,
        items: [],
        summary: {
          itemCount: 0,
          subtotal: 0,
        },
      };
    }

    const items = await Promise.all(
      cart.items.map(async (item) => {
        const pricing = await this.pricingService.getProductPrice(
          userId,
          item.productId,
        );

        const subtotal = pricing.finalPrice * item.quantity;

        return {
          cartItemId: item.id,
          product: {
            id: item.product.id,
            name: item.product.name,
            brand: item.product.brand.name,
            imageUrl: item.product.media[0]?.url ?? null,
          },
          quantity: item.quantity,
          isSelected: item.isSelected,
          pricing: {
            originalPrice: pricing.originalPrice,
            finalPrice: pricing.finalPrice,
            discountPercentage: pricing.discountPercentage,
            isMemberDiscountApplicable: pricing.isMemberDiscountApplicable,
          },
          subtotal,
        };
      }),
    );

    const subtotal = items.reduce((total, item) => total + item.subtotal, 0);

    const itemCount = items.reduce((total, item) => total + item.quantity, 0);

    return {
      cartId: cart.id,
      items,
      summary: {
        itemCount,
        subtotal,
      },
    };
  }

  async updateQuantity(userId: string, cartItemId: string, quantity: number) {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: {
          userId,
        },
      },
      select: {
        id: true,
        cartId: true,
        productId: true,
        quantity: true,
        product: {
          select: {
            inventory: {
              select: {
                availableQuantity: true,
              },
            },
          },
        },
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found.');
    }

    if (!cartItem.product.inventory) {
      throw new BadRequestException('Product inventory not found.');
    }

    /*
     * Decreasing quantity never requires additional stock.
     *
     * Example:
     * Cart quantity = 4
     * Available stock = 0
     * Requested quantity = 3
     *
     * This MUST be allowed because the customer is
     * releasing one unit from their cart.
     */
    const isIncreasing = quantity > cartItem.quantity;

    /*
     * Only validate available stock when the customer
     * is actually increasing the cart quantity.
     */
    if (
      isIncreasing &&
      quantity > cartItem.product.inventory.availableQuantity
    ) {
      throw new BadRequestException(
        `Insufficient stock. Available quantity: ${cartItem.product.inventory.availableQuantity}.`,
      );
    }

    const updatedCartItem = await this.prisma.cartItem.update({
      where: {
        id: cartItem.id,
      },
      data: {
        quantity,
      },
    });

    const pricing = await this.pricingService.getProductPrice(
      userId,
      cartItem.productId,
    );

    return {
      cartItemId: updatedCartItem.id,
      quantity: updatedCartItem.quantity,
      pricing: {
        originalPrice: pricing.originalPrice,
        finalPrice: pricing.finalPrice,
        discountPercentage: pricing.discountPercentage,
        isMemberDiscountApplicable: pricing.isMemberDiscountApplicable,
      },
      subtotal: pricing.finalPrice * updatedCartItem.quantity,
    };
  }

  async removeItem(userId: string, cartItemId: string) {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: {
          userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found.');
    }

    await this.prisma.cartItem.delete({
      where: {
        id: cartItem.id,
      },
    });

    return this.getMyCart(userId);
  }

  async updateSelection(
    userId: string,
    cartItemId: string,
    isSelected: boolean,
  ) {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: {
          userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found.');
    }

    const updatedCartItem = await this.prisma.cartItem.update({
      where: {
        id: cartItem.id,
      },
      data: {
        isSelected,
      },
    });

    return {
      cartItemId: updatedCartItem.id,
      isSelected: updatedCartItem.isSelected,
    };
  }
}
