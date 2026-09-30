'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
    getCustomerAddresses,
    type CustomerAddress,
} from '@/api/customer'

import {
    getCheckoutSummary,
    placeOrder,
    type CheckoutShippingOption,
    type CheckoutSummary,
    type PlaceOrderPayload,
} from '@/api/checkout'

function formatRp(value: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(value)
}

type PaymentMethodId =
    | 'qris'
    | 'virtual_account'
    | 'manual_transfer'

interface PaymentMethod {
    id: PaymentMethodId
    name: string
    description: string
    enabled: boolean
}

const PAYMENT_METHODS: PaymentMethod[] = [
    {
        id: 'qris',
        name: 'QRIS',
        description:
            'Scan kode QR dengan aplikasi pembayaran apa pun',
        enabled: true,
    },
    {
        id: 'virtual_account',
        name: 'Virtual Account',
        description:
            'Transfer melalui ATM atau mobile banking',
        enabled: true,
    },
    {
        id: 'manual_transfer',
        name: 'Transfer Bank Manual',
        description:
            'Transfer ke rekening bank Ruma',
        enabled: true,
    },
]

function mapPaymentMethod(
    paymentMethod: PaymentMethodId,
): PlaceOrderPayload['paymentMethod'] {
    switch (paymentMethod) {
        case 'qris':
            return 'QRIS'

        case 'virtual_account':
            return 'VIRTUAL_ACCOUNT'

        case 'manual_transfer':
            return 'MANUAL_BANK_TRANSFER'
    }
}

function createIdempotencyKey(): string {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return `checkout-${crypto.randomUUID()}`
    }

    return `checkout-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`
}

/* ========================================================= */
/* Ruma mark                                                  */
/* ========================================================= */

function RumaMark({ size = 20 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 26 26"
            fill="none"
            aria-hidden="true"
        >
            <circle
                cx="13"
                cy="13"
                r="11.5"
                stroke="currentColor"
                strokeWidth="1.25"
            />

            <circle
                cx="13"
                cy="13"
                r="4"
                fill="currentColor"
            />
        </svg>
    )
}

/* ========================================================= */
/* Header                                                     */
/* ========================================================= */

function CheckoutHeader({
    onBack,
}: {
    onBack: () => void
}) {
    return (
        <header className="sticky top-0 z-40 bg-white border-b border-line">
            <div className="max-w-350 mx-auto px-4 lg:px-8 h-15 flex items-center justify-between">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 text-ink hover:text-brand transition-colors"
                >
                    <RumaMark />

                    <span
                        className="text-lg font-semibold tracking-tight"
                        style={{
                            fontFamily:
                                'Fraunces, Georgia, serif',
                        }}
                    >
                        Ruma
                    </span>
                </button>

                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-sm text-ink-sub hover:text-brand font-medium transition-colors"
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line
                            x1="19"
                            y1="12"
                            x2="5"
                            y2="12"
                        />

                        <polyline points="12 19 5 12 12 5" />
                    </svg>

                    Kembali ke keranjang
                </button>
            </div>
        </header>
    )
}

/* ========================================================= */
/* Address modal                                              */
/* ========================================================= */

function AddressSelectModal({
    addresses,
    selectedId,
    onSelect,
    onClose,
}: {
    addresses: CustomerAddress[]
    selectedId: string
    onSelect: (id: string) => void
    onClose: () => void
}) {
    const [pendingId, setPendingId] =
        useState(selectedId)

    return (
        <>
            <div
                className="fixed inset-0 bg-black/40 z-50"
                onClick={onClose}
            />

            <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
                <div className="bg-white w-full md:max-w-120 rounded-t-xl md:rounded-sm shadow-2xl max-h-[85vh] flex flex-col">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
                        <h3 className="text-sm font-semibold text-ink">
                            Pilih Alamat Pengiriman
                        </h3>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center text-ink-muted hover:text-ink transition-colors rounded-md hover:bg-canvas"
                            aria-label="Tutup"
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line
                                    x1="18"
                                    y1="6"
                                    x2="6"
                                    y2="18"
                                />

                                <line
                                    x1="6"
                                    y1="6"
                                    x2="18"
                                    y2="18"
                                />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                        {addresses.map((address) => (
                            <button
                                type="button"
                                key={address.id}
                                onClick={() =>
                                    setPendingId(
                                        address.id,
                                    )
                                }
                                className={`w-full text-left p-4 rounded-sm border transition-all ${
                                    pendingId === address.id
                                        ? 'border-brand bg-brand-tint'
                                        : 'border-line hover:border-line-strong'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                                            pendingId ===
                                            address.id
                                                ? 'border-brand'
                                                : 'border-line-strong'
                                        }`}
                                    >
                                        {pendingId ===
                                            address.id && (
                                            <div className="w-2 h-2 rounded-full bg-brand" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-ink">
                                            {
                                                address.recipientName
                                            }
                                        </p>

                                        <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                                            {
                                                address.addressLine
                                            }
                                            <br />
                                            {
                                                address.district
                                            }
                                            , {address.city}
                                            <br />
                                            {
                                                address.province
                                            }
                                            ,{' '}
                                            {
                                                address.postalCode
                                            }
                                        </p>

                                        <p className="text-xs text-ink-muted mt-1">
                                            {address.phone}
                                        </p>

                                        {address.isDefault && (
                                            <span className="inline-block mt-1.5 text-[10px] text-brand font-medium bg-brand-tint border border-brand/20 px-1.5 py-0.5 rounded">
                                                Default
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}

                        <button
                            type="button"
                            disabled
                            className="w-full text-left p-4 rounded-sm border border-dashed border-line flex items-center gap-3 opacity-60 cursor-not-allowed"
                        >
                            <div className="w-4 h-4 rounded-full border-2 border-line-strong shrink-0 flex items-center justify-center">
                                <svg
                                    width="8"
                                    height="8"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                >
                                    <line
                                        x1="12"
                                        y1="5"
                                        x2="12"
                                        y2="19"
                                    />

                                    <line
                                        x1="5"
                                        y1="12"
                                        x2="19"
                                        y2="12"
                                    />
                                </svg>
                            </div>

                            <span className="text-sm text-brand font-medium">
                                Tambah Alamat Baru
                            </span>
                        </button>
                    </div>

                    <div className="px-4 py-4 border-t border-line shrink-0">
                        <button
                            type="button"
                            disabled={!pendingId}
                            onClick={() => {
                                if (!pendingId) return

                                onSelect(pendingId)
                            }}
                            className="w-full h-11 bg-brand text-white text-sm font-semibold rounded-md hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Gunakan Alamat Ini
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}

/* ========================================================= */
/* Shipping address                                           */
/* ========================================================= */

function ShippingAddressSection({
    address,
    onChangeAddress,
}: {
    address: CustomerAddress | null
    onChangeAddress: () => void
}) {
    return (
        <div className="bg-white border border-line rounded-sm">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="text-sm font-semibold text-ink">
                    Alamat Pengiriman
                </h2>

                <button
                    type="button"
                    onClick={onChangeAddress}
                    className="text-xs text-brand hover:text-brand-dark font-medium transition-colors"
                >
                    Ubah
                </button>
            </div>

            <div className="px-5 pb-5">
                {address ? (
                    <div className="text-sm leading-relaxed">
                        <p className="font-medium text-ink">
                            {address.recipientName}
                        </p>

                        <p className="text-ink-sub mt-0.5">
                            {address.addressLine}
                        </p>

                        <p className="text-ink-sub">
                            {address.district},{' '}
                            {address.city}
                        </p>

                        <p className="text-ink-sub">
                            {address.province},{' '}
                            {address.postalCode}
                        </p>

                        <p className="text-ink-muted text-xs mt-1">
                            {address.phone}
                        </p>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onChangeAddress}
                        className="flex items-center gap-1.5 text-sm text-brand hover:text-brand-dark font-medium transition-colors"
                    >
                        <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        >
                            <line
                                x1="12"
                                y1="5"
                                x2="12"
                                y2="19"
                            />

                            <line
                                x1="5"
                                y1="12"
                                x2="19"
                                y2="12"
                            />
                        </svg>

                        Tambah alamat pengiriman
                    </button>
                )}
            </div>
        </div>
    )
}

/* ========================================================= */
/* Delivery method                                            */
/* ========================================================= */

function DeliveryMethodSection({
    options,
    selectedId,
    onSelect,
    loading,
    error,
    onRetry,
}: {
    options: CheckoutShippingOption[]
    selectedId: string
    onSelect: (id: string) => void
    loading: boolean
    error: boolean
    onRetry: () => void
}) {
    return (
        <div className="bg-white border border-line rounded-sm p-5">
            <h2 className="text-sm font-semibold text-ink mb-4">
                Metode Pengiriman
            </h2>

            {loading && (
                <div className="space-y-2.5">
                    {[0, 1, 2].map((item) => (
                        <div
                            key={item}
                            className="h-15 bg-canvas rounded animate-pulse"
                        />
                    ))}
                </div>
            )}

            {!loading && error && (
                <div className="flex items-center gap-3 py-2">
                    <p className="text-sm text-ink-muted flex-1">
                        Tidak dapat memuat opsi
                        pengiriman. Silakan coba
                        lagi.
                    </p>

                    <button
                        type="button"
                        onClick={onRetry}
                        className="text-sm text-brand font-medium hover:text-brand-dark transition-colors shrink-0"
                    >
                        Coba lagi
                    </button>
                </div>
            )}

            {!loading &&
                !error &&
                options.length === 0 && (
                    <p className="text-sm text-ink-muted">
                        Tidak ada opsi pengiriman
                        yang tersedia.
                    </p>
                )}

            {!loading &&
                !error &&
                options.length > 0 && (
                    <div className="space-y-2">
                        {options.map((option) => {
                            const id = `${option.courierCode}-${option.serviceCode}`

                            const selected =
                                selectedId === id

                            return (
                                <button
                                    type="button"
                                    key={id}
                                    onClick={() =>
                                        onSelect(id)
                                    }
                                    className={`w-full flex items-center gap-3 p-4 rounded-sm border transition-all text-left ${
                                        selected
                                            ? 'border-brand bg-brand-tint'
                                            : 'border-line hover:border-line-strong'
                                    }`}
                                >
                                    <div
                                        className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                            selected
                                                ? 'border-brand'
                                                : 'border-line-strong'
                                        }`}
                                    >
                                        {selected && (
                                            <div className="w-2 h-2 rounded-full bg-brand" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-ink">
                                            {
                                                option.courierName
                                            }{' '}
                                            <span className="font-normal text-ink-muted">
                                                {
                                                    option.serviceName
                                                }
                                            </span>
                                        </p>

                                        <p className="text-xs text-ink-muted mt-0.5">
                                            Estimasi{' '}
                                            {
                                                option.estimatedDelivery
                                            }
                                        </p>
                                    </div>

                                    <p className="text-sm font-semibold text-ink shrink-0">
                                        {formatRp(
                                            option.price,
                                        )}
                                    </p>
                                </button>
                            )
                        })}
                    </div>
                )}
        </div>
    )
}

/* ========================================================= */
/* Order items                                                */
/* ========================================================= */

function OrderItemsSection({
    summary,
}: {
    summary: CheckoutSummary
}) {
    if (summary.items.length === 0) {
        return null
    }

    return (
        <div className="bg-white border border-line rounded-sm p-5">
            <h2 className="text-sm font-semibold text-ink mb-4">
                Ringkasan Produk
            </h2>

            <div className="divide-y divide-line">
                {summary.items.map((item) => (
                    <div
                        key={item.cartItemId}
                        className="flex gap-3 py-3.5 first:pt-0 last:pb-0"
                    >
                        <div className="w-14 h-17.5 rounded-sm overflow-hidden bg-canvas shrink-0">
                            {item.product.imageUrl ? (
                                <img
                                    src={
                                        item.product
                                            .imageUrl
                                    }
                                    alt={
                                        item.product.name
                                    }
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-ink-faint">
                                    No image
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium text-brand uppercase tracking-widest mb-0.5">
                                {item.product.brand}
                            </p>

                            <p className="text-sm font-medium text-ink leading-snug line-clamp-2">
                                {item.product.name}
                            </p>

                            <p className="text-xs text-ink-muted mt-1">
                                Qty: {item.quantity}
                            </p>
                        </div>

                        <div className="text-right shrink-0 ml-2">
                            <p className="text-sm font-semibold text-ink">
                                {formatRp(
                                    item.subtotal,
                                )}
                            </p>

                            {item.quantity > 1 && (
                                <p className="text-xs text-ink-faint mt-0.5">
                                    {formatRp(
                                        item.pricing
                                            .finalPrice,
                                    )}{' '}
                                    × {item.quantity}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

/* ========================================================= */
/* Payment method                                             */
/* ========================================================= */

function PaymentMethodSection({
    selectedId,
    onSelect,
}: {
    selectedId: PaymentMethodId | null
    onSelect: (id: PaymentMethodId) => void
}) {
    return (
        <div className="bg-white border border-line rounded-sm p-5">
            <h2 className="text-sm font-semibold text-ink mb-4">
                Metode Pembayaran
            </h2>

            <div className="space-y-2">
                {PAYMENT_METHODS.map((method) => {
                    const selected =
                        selectedId === method.id

                    return (
                        <button
                            type="button"
                            key={method.id}
                            disabled={!method.enabled}
                            onClick={() =>
                                onSelect(method.id)
                            }
                            className={`w-full flex items-start gap-3 p-4 rounded-sm border transition-all text-left ${
                                selected
                                    ? 'border-brand bg-brand-tint'
                                    : 'border-line hover:border-line-strong'
                            } ${
                                !method.enabled
                                    ? 'opacity-50 cursor-not-allowed'
                                    : ''
                            }`}
                        >
                            <div
                                className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                                    selected
                                        ? 'border-brand'
                                        : 'border-line-strong'
                                }`}
                            >
                                {selected && (
                                    <div className="w-2 h-2 rounded-full bg-brand" />
                                )}
                            </div>

                            <div>
                                <p className="text-sm font-medium text-ink">
                                    {method.name}
                                </p>

                                <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                                    {method.description}
                                </p>

                                {!method.enabled && (
                                    <p className="text-[11px] text-ink-faint mt-1">
                                        Belum tersedia
                                    </p>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

/* ========================================================= */
/* Order summary                                              */
/* ========================================================= */

function OrderSummaryCard({
    subtotalRp,
    discountRp,
    shippingRp,
    totalRp,
    onPlaceOrder,
    canPlace,
    loading,
}: {
    subtotalRp: number
    discountRp: number
    shippingRp: number
    totalRp: number
    onPlaceOrder: () => void
    canPlace: boolean
    loading: boolean
}) {
    return (
        <div className="bg-white border border-line rounded-sm p-6 sticky top-19">
            <h2 className="text-sm font-semibold text-ink mb-5">
                Ringkasan Pesanan
            </h2>

            <div className="space-y-2.5 pb-4 border-b border-line">
                <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">
                        Subtotal
                    </span>

                    <span className="text-ink">
                        {formatRp(subtotalRp)}
                    </span>
                </div>

                {discountRp > 0 && (
                    <div className="flex justify-between text-sm">
                        <span className="text-ink-muted">
                            Diskon
                        </span>

                        <span className="text-ink">
                            -{formatRp(discountRp)}
                        </span>
                    </div>
                )}

                <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">
                        Ongkos kirim
                    </span>

                    <span className="text-ink">
                        {shippingRp > 0
                            ? formatRp(shippingRp)
                            : '–'}
                    </span>
                </div>
            </div>

            <div className="flex justify-between items-baseline pt-4 mb-6">
                <span className="text-sm font-semibold text-ink">
                    Total
                </span>

                <span className="text-xl font-bold text-ink">
                    {formatRp(totalRp)}
                </span>
            </div>

            <button
                type="button"
                onClick={onPlaceOrder}
                disabled={!canPlace || loading}
                className="w-full h-12 bg-brand text-white text-sm font-semibold rounded-md hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
                {loading ? (
                    <>
                        <svg
                            className="animate-spin w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M21 12a9 9 0 11-6.22-8.56" />
                        </svg>

                        Memproses…
                    </>
                ) : (
                    'Buat Pesanan'
                )}
            </button>

            {!canPlace && !loading && (
                <p className="text-[11px] text-ink-muted text-center mt-2.5 leading-relaxed">
                    Lengkapi alamat, pengiriman,
                    dan pembayaran untuk
                    melanjutkan.
                </p>
            )}
        </div>
    )
}

/* ========================================================= */
/* Mobile summary                                             */
/* ========================================================= */

function MobileOrderSummary({
    subtotalRp,
    discountRp,
    shippingRp,
    totalRp,
    onPlaceOrder,
    canPlace,
    loading,
}: {
    subtotalRp: number
    discountRp: number
    shippingRp: number
    totalRp: number
    onPlaceOrder: () => void
    canPlace: boolean
    loading: boolean
}) {
    return (
        <div className="bg-white border border-line rounded-sm p-5">
            <h2 className="text-sm font-semibold text-ink mb-4">
                Ringkasan Pesanan
            </h2>

            <div className="space-y-2.5 pb-4 border-b border-line mb-4">
                <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">
                        Subtotal
                    </span>

                    <span className="text-ink">
                        {formatRp(subtotalRp)}
                    </span>
                </div>

                {discountRp > 0 && (
                    <div className="flex justify-between text-sm">
                        <span className="text-ink-muted">
                            Diskon
                        </span>

                        <span className="text-ink">
                            -{formatRp(discountRp)}
                        </span>
                    </div>
                )}

                <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">
                        Ongkos kirim
                    </span>

                    <span className="text-ink">
                        {shippingRp > 0
                            ? formatRp(shippingRp)
                            : '–'}
                    </span>
                </div>

                <div className="flex justify-between">
                    <span className="text-sm font-semibold text-ink">
                        Total
                    </span>

                    <span className="text-lg font-bold text-ink">
                        {formatRp(totalRp)}
                    </span>
                </div>
            </div>

            <button
                type="button"
                onClick={onPlaceOrder}
                disabled={!canPlace || loading}
                className="w-full h-12 bg-brand text-white text-sm font-semibold rounded-md hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
                {loading ? (
                    <>
                        <svg
                            className="animate-spin w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M21 12a9 9 0 11-6.22-8.56" />
                        </svg>

                        Memproses…
                    </>
                ) : (
                    'Buat Pesanan'
                )}
            </button>

            {!canPlace && !loading && (
                <p className="text-[11px] text-ink-muted text-center mt-2.5 leading-relaxed">
                    Lengkapi alamat, pengiriman,
                    dan pembayaran untuk
                    melanjutkan.
                </p>
            )}
        </div>
    )
}

/* ========================================================= */
/* Loading                                                    */
/* ========================================================= */

function CheckoutSkeleton() {
    return (
        <div className="min-h-screen bg-canvas">
            <div className="h-15 bg-white border-b border-line" />

            <div className="max-w-350 mx-auto px-4 lg:px-8 pt-7 pb-16">
                <div className="h-6 w-24 bg-line rounded animate-pulse mb-7" />

                <div className="flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-4 w-full">
                        {[88, 160, 180, 160].map(
                            (height, index) => (
                                <div
                                    key={index}
                                    className="bg-white border border-line rounded-sm p-5 space-y-3"
                                >
                                    <div className="h-4 w-32 bg-line rounded animate-pulse" />

                                    <div
                                        style={{
                                            height:
                                                height -
                                                56,
                                        }}
                                        className="bg-canvas rounded animate-pulse"
                                    />
                                </div>
                            ),
                        )}
                    </div>

                    <div className="hidden lg:block w-85 shrink-0">
                        <div className="bg-white border border-line rounded-sm p-6 space-y-4">
                            <div className="h-4 w-28 bg-line rounded animate-pulse" />
                            <div className="h-3 w-full bg-line rounded animate-pulse" />
                            <div className="h-3 w-full bg-line rounded animate-pulse" />
                            <div className="h-px bg-line my-2" />
                            <div className="h-5 w-full bg-line rounded animate-pulse" />
                            <div className="h-12 w-full bg-line rounded animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ========================================================= */
/* Error                                                     */
/* ========================================================= */

function CheckoutError({
    message,
    onRetry,
    onBack,
}: {
    message: string
    onRetry: () => void
    onBack: () => void
}) {
    return (
        <div className="min-h-screen bg-canvas">
            <CheckoutHeader onBack={onBack} />

            <div className="max-w-120 mx-auto px-4 pt-20 pb-16 text-center">
                <div className="w-16 h-16 rounded-full bg-error-tint border border-error/20 flex items-center justify-center mx-auto mb-5">
                    <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#b84444"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="10"
                        />

                        <line
                            x1="12"
                            y1="8"
                            x2="12"
                            y2="12"
                        />

                        <line
                            x1="12"
                            y1="16"
                            x2="12.01"
                            y2="16"
                        />
                    </svg>
                </div>

                <h2 className="text-base font-semibold text-ink mb-2">
                    Terjadi kesalahan
                </h2>

                <p className="text-sm text-ink-muted leading-relaxed mb-7">
                    {message}
                </p>

                <div className="flex gap-3 justify-center">
                    <button
                        type="button"
                        onClick={onRetry}
                        className="h-10 px-5 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand-dark transition-colors"
                    >
                        Coba lagi
                    </button>

                    <button
                        type="button"
                        onClick={onBack}
                        className="h-10 px-5 border border-line text-sm font-medium text-ink-sub rounded-md hover:border-line-strong hover:text-ink transition-colors"
                    >
                        Kembali ke keranjang
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ========================================================= */
/* Main Checkout                                              */
/* ========================================================= */

export default function Checkout() {
    const router = useRouter()

    const [addresses, setAddresses] =
        useState<CustomerAddress[]>([])

    const [selectedAddressId, setSelectedAddressId] =
        useState('')

    const [summary, setSummary] =
        useState<CheckoutSummary | null>(null)

    const [loading, setLoading] = useState(true)

    const [summaryLoading, setSummaryLoading] =
        useState(false)

    const [error, setError] =
        useState<string | null>(null)

    const [addressModalOpen, setAddressModalOpen] =
        useState(false)

    const [selectedDeliveryId, setSelectedDeliveryId] =
        useState('')

    const [selectedPaymentId, setSelectedPaymentId] =
        useState<PaymentMethodId | null>(
            'manual_transfer',
        )

    const [placingOrder, setPlacingOrder] =
        useState(false)

    /* ========================================================= */
    /* Load addresses                                             */
    /* ========================================================= */

    async function loadAddresses() {
        const customerAddresses =
            await getCustomerAddresses()

        setAddresses(customerAddresses)

        const currentSelected =
            customerAddresses.find(
                (address) =>
                    address.id === selectedAddressId,
            )

        if (currentSelected) {
            return currentSelected.id
        }

        const defaultAddress =
            customerAddresses.find(
                (address) => address.isDefault,
            ) ?? customerAddresses[0]

        if (!defaultAddress) {
            setSelectedAddressId('')
            return ''
        }

        setSelectedAddressId(defaultAddress.id)

        return defaultAddress.id
    }

    /* ========================================================= */
    /* Load checkout summary                                     */
    /* ========================================================= */

    async function loadSummary(addressId: string) {
        if (!addressId) {
            setSummary(null)
            return
        }

        setSummaryLoading(true)
        setError(null)

        try {
            const checkoutSummary =
                await getCheckoutSummary(addressId)

            setSummary(checkoutSummary)

            const firstShipping =
                checkoutSummary.shippingOptions[0]

            if (firstShipping) {
                setSelectedDeliveryId(
                    `${firstShipping.courierCode}-${firstShipping.serviceCode}`,
                )
            } else {
                setSelectedDeliveryId('')
            }
        } finally {
            setSummaryLoading(false)
        }
    }

    /* ========================================================= */
    /* Initial load                                               */
    /* ========================================================= */

    useEffect(() => {
        let mounted = true

        async function initializeCheckout() {
            try {
                setLoading(true)
                setError(null)

                const addressId =
                    await loadAddresses()

                if (!mounted) return

                if (!addressId) {
                    setLoading(false)
                    return
                }

                const checkoutSummary =
                    await getCheckoutSummary(
                        addressId,
                    )

                if (!mounted) return

                setSummary(checkoutSummary)

                const firstShipping =
                    checkoutSummary.shippingOptions[0]

                if (firstShipping) {
                    setSelectedDeliveryId(
                        `${firstShipping.courierCode}-${firstShipping.serviceCode}`,
                    )
                }
            } catch (err) {
                if (!mounted) return

                setError(
                    err instanceof Error
                        ? err.message
                        : 'Tidak dapat memuat halaman checkout.',
                )
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        void initializeCheckout()

        return () => {
            mounted = false
        }
    }, [])

    /* ========================================================= */
    /* Address change                                             */
    /* ========================================================= */

    async function handleAddressChange(
        addressId: string,
    ) {
        setSelectedAddressId(addressId)
        setAddressModalOpen(false)

        try {
            await loadSummary(addressId)
        } catch (err) {
            setSummary(null)

            setError(
                err instanceof Error
                    ? err.message
                    : 'Tidak dapat memuat ringkasan checkout.',
            )
        }
    }

    /* ========================================================= */
    /* Retry                                                     */
    /* ========================================================= */

    async function handleRetry() {
        try {
            setLoading(true)
            setError(null)

            const addressId =
                await loadAddresses()

            if (!addressId) {
                setLoading(false)
                return
            }

            const checkoutSummary =
                await getCheckoutSummary(addressId)

            setSummary(checkoutSummary)

            const firstShipping =
                checkoutSummary.shippingOptions[0]

            setSelectedDeliveryId(
                firstShipping
                    ? `${firstShipping.courierCode}-${firstShipping.serviceCode}`
                    : '',
            )
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Tidak dapat memuat halaman checkout.',
            )
        } finally {
            setLoading(false)
        }
    }

    /* ========================================================= */
    /* Derived data                                               */
    /* ========================================================= */

    const selectedAddress =
        addresses.find(
            (address) =>
                address.id === selectedAddressId,
        ) ?? null

    const selectedShipping =
        summary?.shippingOptions.find(
            (option) =>
                `${option.courierCode}-${option.serviceCode}` ===
                selectedDeliveryId,
        ) ?? null

    const subtotalRp =
        summary?.summary.subtotalAmount ?? 0

    const discountRp =
        summary?.summary.discountAmount ?? 0

    const shippingRp =
        selectedShipping?.price ?? 0

    const totalRp =
        subtotalRp + shippingRp

    const canPlaceOrder =
        !!selectedAddress &&
        !!selectedShipping &&
        !!selectedPaymentId &&
        !!summary &&
        summary.items.length > 0

    const hasAddresses = addresses.length > 0

    /* ========================================================= */
    /* Place order                                                */
    /* ========================================================= */

    async function handlePlaceOrder() {
        if (!canPlaceOrder || placingOrder) {
            return
        }

        if (!selectedAddress) {
            return
        }

        if (!selectedShipping) {
            return
        }

        if (!selectedPaymentId) {
            return
        }

        setPlacingOrder(true)
        setError(null)

        try {
            const payload: PlaceOrderPayload = {
                addressId: selectedAddress.id,
                courierCode:
                    selectedShipping.courierCode,
                serviceCode:
                    selectedShipping.serviceCode,
                paymentMethod:
                    mapPaymentMethod(
                        selectedPaymentId,
                    ),
            }

            const result = await placeOrder(
                payload,
                createIdempotencyKey(),
            )

            /*
             * Checkout backend berhasil membuat order.
             *
             * Payment UI akan diintegrasikan pada
             * milestone berikutnya. Untuk sementara,
             * arahkan user ke payment page jika route
             * tersebut sudah tersedia.
             */
            router.push(
                `/payment?orderId=${encodeURIComponent(
                    result.orderId,
                )}&paymentId=${encodeURIComponent(
                    result.payment.id,
                )}`,
            )
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Tidak dapat membuat pesanan.',
            )
        } finally {
            setPlacingOrder(false)
        }
    }

    /* ========================================================= */
    /* Loading state                                              */
    /* ========================================================= */

    if (loading) {
        return <CheckoutSkeleton />
    }

    /* ========================================================= */
    /* Error state                                                */
    /* ========================================================= */

    if (error && !summary && !hasAddresses) {
        return (
            <CheckoutError
                message={error}
                onRetry={handleRetry}
                onBack={() => router.push('/cart')}
            />
        )
    }

    /* ========================================================= */
    /* No address                                                 */
    /* ========================================================= */

    if (!hasAddresses) {
        return (
            <div className="min-h-screen bg-canvas">
                <CheckoutHeader
                    onBack={() => router.push('/cart')}
                />

                <div className="max-w-120 mx-auto px-4 pt-20 pb-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-brand-tint border border-brand/20 flex items-center justify-center mx-auto mb-5">
                        <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1116 0Z" />

                            <circle
                                cx="12"
                                cy="10"
                                r="2.5"
                            />
                        </svg>
                    </div>

                    <h2 className="text-base font-semibold text-ink mb-2">
                        Belum ada alamat pengiriman
                    </h2>

                    <p className="text-sm text-ink-muted leading-relaxed mb-7">
                        Tambahkan alamat pengiriman
                        terlebih dahulu sebelum
                        melanjutkan checkout.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            router.push('/account')
                        }
                        className="h-10 px-5 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand-dark transition-colors"
                    >
                        Tambah Alamat
                    </button>
                </div>
            </div>
        )
    }

    /* ========================================================= */
    /* Main UI                                                    */
    /* ========================================================= */

    return (
        <div className="min-h-screen bg-canvas">
            <CheckoutHeader
                onBack={() => router.push('/cart')}
            />

            <div className="max-w-350 mx-auto px-4 lg:px-8 pt-7 pb-16">
                <h1
                    className="text-xl font-semibold text-ink tracking-tight mb-7"
                    style={{
                        fontFamily:
                            'Fraunces, Georgia, serif',
                    }}
                >
                    Checkout
                </h1>

                {error && (
                    <div
                        role="alert"
                        className="mb-4 rounded-sm border border-error/20 bg-error-tint px-4 py-3 text-sm text-error"
                    >
                        {error}
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 min-w-0 space-y-4 w-full">
                        {/* Address */}
                        <ShippingAddressSection
                            address={selectedAddress}
                            onChangeAddress={() =>
                                setAddressModalOpen(
                                    true,
                                )
                            }
                        />

                        {/* Delivery */}
                        <DeliveryMethodSection
                            options={
                                summary?.shippingOptions ??
                                []
                            }
                            selectedId={
                                selectedDeliveryId
                            }
                            onSelect={
                                setSelectedDeliveryId
                            }
                            loading={summaryLoading}
                            error={
                                !summaryLoading &&
                                !summary
                            }
                            onRetry={() => {
                                if (
                                    selectedAddressId
                                ) {
                                    void loadSummary(
                                        selectedAddressId,
                                    )
                                }
                            }}
                        />

                        {/* Items */}
                        {summary && (
                            <OrderItemsSection
                                summary={summary}
                            />
                        )}

                        {/* Payment */}
                        <PaymentMethodSection
                            selectedId={
                                selectedPaymentId
                            }
                            onSelect={
                                setSelectedPaymentId
                            }
                        />

                        {/* Mobile summary */}
                        <div className="lg:hidden">
                            <MobileOrderSummary
                                subtotalRp={
                                    subtotalRp
                                }
                                discountRp={
                                    discountRp
                                }
                                shippingRp={
                                    shippingRp
                                }
                                totalRp={totalRp}
                                onPlaceOrder={
                                    handlePlaceOrder
                                }
                                canPlace={
                                    canPlaceOrder
                                }
                                loading={
                                    placingOrder
                                }
                            />
                        </div>
                    </div>

                    {/* Desktop summary */}
                    <div className="hidden lg:block w-85 shrink-0">
                        <OrderSummaryCard
                            subtotalRp={
                                subtotalRp
                            }
                            discountRp={
                                discountRp
                            }
                            shippingRp={
                                shippingRp
                            }
                            totalRp={totalRp}
                            onPlaceOrder={
                                handlePlaceOrder
                            }
                            canPlace={
                                canPlaceOrder
                            }
                            loading={
                                placingOrder
                            }
                        />
                    </div>
                </div>
            </div>

            {/* Address modal */}
            {addressModalOpen && (
                <AddressSelectModal
                    addresses={addresses}
                    selectedId={
                        selectedAddressId
                    }
                    onSelect={
                        handleAddressChange
                    }
                    onClose={() =>
                        setAddressModalOpen(
                            false,
                        )
                    }
                />
            )}
        </div>
    )
}