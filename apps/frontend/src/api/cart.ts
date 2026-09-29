import { apiRequest } from './client';

export interface CartProduct {
  id: string;
  name: string;
  brand: string;
  imageUrl: string;
}

export interface CartItemPricing {
  originalPrice: number;
  finalPrice: number;
  discountPercentage: number;
  isMemberDiscountApplicable: boolean;
}

export interface CartItem {
  cartItemId: string;
  product: CartProduct;
  quantity: number;
  isSelected: boolean;
  pricing: CartItemPricing;
  subtotal: number;
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
}

export interface CustomerCart {
  cartId: string;
  items: CartItem[];
  summary: CartSummary;
}

interface CartResponse {
  success: boolean;
  message: string;
  data: {
    cart: CustomerCart;
  };
}

interface CartItemResponse {
  success: boolean;
  message: string;
  data: {
    cartItem: CartItem;
  };
}

interface CartActionResponse {
  success: boolean;
  message: string;
  data: {
    cart: CustomerCart;
  };
}

/**
 * Get current customer's shopping cart.
 */
export async function getCart(): Promise<CustomerCart> {
  const response = await apiRequest<CartResponse>('/customer/cart');

  return response.data.cart;
}

/**
 * Add a product to the customer's cart.
 *
 * If the product already exists in the cart, the backend
 * increases its quantity.
 */
export async function addToCart(
  productId: string,
  quantity: number,
): Promise<CustomerCart> {
  const response = await apiRequest<CartActionResponse>(
    '/customer/cart/items',
    {
      method: 'POST',
      body: JSON.stringify({
        productId,
        quantity,
      }),
    },
  );

  return response.data.cart;
}

/**
 * Update cart item quantity.
 */
export async function updateCartQuantity(
  cartItemId: string,
  quantity: number,
): Promise<CustomerCart> {
  const response = await apiRequest<CartActionResponse>(
    `/customer/cart/items/${cartItemId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        quantity,
      }),
    },
  );

  return response.data.cart;
}

/**
 * Update cart item selection state.
 */
export async function updateCartItemSelection(
  cartItemId: string,
  isSelected: boolean,
): Promise<CustomerCart> {
  const response = await apiRequest<CartActionResponse>(
    `/customer/cart/items/${cartItemId}/selection`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        isSelected,
      }),
    },
  );

  return response.data.cart;
}

/**
 * Remove an item from the customer's cart.
 */
export async function removeCartItem(
  cartItemId: string,
): Promise<CustomerCart> {
  const response = await apiRequest<CartActionResponse>(
    `/customer/cart/items/${cartItemId}`,
    {
      method: 'DELETE',
    },
  );

  return response.data.cart;
}