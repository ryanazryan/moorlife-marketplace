import { apiRequest } from './client'

export type CheckoutItem = {
  cartItemId: string
  product: {
    id: string
    sku: string
    name: string
    brand: string
    imageUrl: string | null
  }
  quantity: number
  pricing: {
    originalPrice: number
    finalPrice: number
    discountPercentage: number
    isMemberDiscountApplicable: boolean
  }
  subtotal: number
}

export type CheckoutShippingAddress = {
  id: string
  label: string
  recipientName: string
  phone: string
  addressLine: string
  district: string
  city: string
  province: string
  postalCode: string
}

export type CheckoutShippingOption = {
  courierCode: string
  courierName: string
  serviceCode: string
  serviceName: string
  price: number
  estimatedDelivery: string
}

export type CheckoutSummary = {
  items: CheckoutItem[]
  shippingAddress: CheckoutShippingAddress
  summary: {
    originalSubtotalAmount: number
    subtotalAmount: number
    discountAmount: number
    shippingAmount: number
    totalAmount: number
  }
  shippingOptions: CheckoutShippingOption[]
}

type CheckoutSummaryResponse = {
  success: boolean
  message: string
  data: CheckoutSummary
}

export type PlaceOrderPayload = {
  addressId: string
  courierCode: string
  serviceCode: string
  paymentMethod:
    | 'QRIS'
    | 'VIRTUAL_ACCOUNT'
    | 'MANUAL_BANK_TRANSFER'
}

export type PlaceOrderResult = {
  orderId: string
  orderNumber: string
  status: string
  summary: {
    originalSubtotalAmount: number
    subtotalAmount: number
    discountAmount: number
    shippingAmount: number
    totalAmount: number
  }
  shipping: {
    courierCode: string
    courierName: string
    serviceCode: string
    serviceName: string
    price: number
    estimatedDelivery: string
  }
  payment: {
    id: string
    method: PlaceOrderPayload['paymentMethod']
    status: string
    amount: number
    provider: string | null
    expiresAt: string
  }
}

type PlaceOrderResponse = {
  success: boolean
  message: string
  data: PlaceOrderResult
}

export async function getCheckoutSummary(
  addressId: string,
): Promise<CheckoutSummary> {
  const response = await apiRequest<CheckoutSummaryResponse>(
    `/customer/checkout/summary?addressId=${encodeURIComponent(addressId)}`,
  )

  return response.data
}

export async function placeOrder(
  payload: PlaceOrderPayload,
  idempotencyKey: string,
): Promise<PlaceOrderResult> {
  const response = await apiRequest<PlaceOrderResponse>(
    '/customer/checkout',
    {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    },
  )

  return response.data
}