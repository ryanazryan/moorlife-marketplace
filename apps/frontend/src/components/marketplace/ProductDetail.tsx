'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiRequest } from '@/api/client'
import type { ApiProduct } from '@/api/products'
import { useWishlist } from '@/components/providers/WishlistProvider'

interface ProductDetailProps {
    product: ApiProduct
    rating?: {
        averageRating: number | null
        totalReviews: number
        ratingDistribution: {
            5: number
            4: number
            3: number
            2: number
            1: number
        }
    }
    reviews?: Array<{
        id: string
        productId: string
        userId: string
        rating: number
        reviewText: string | null
        createdAt: string
        updatedAt: string
        user: {
            id: string
            fullName: string
        }
    }>
    relatedProducts?: ApiProduct[]
}

function formatPrice(price: number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(price)
}

function RatingStars({
    rating,
    size = 14,
}: {
    rating: number
    size?: number
}) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => {
                const filled = rating >= star

                return (
                    <svg
                        key={star}
                        width={size}
                        height={size}
                        viewBox="0 0 24 24"
                        fill={filled ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className={
                            filled ? 'text-gold' : 'text-ink-faint'
                        }
                        aria-hidden="true"
                    >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                )
            })}
        </div>
    )
}

function RatingBar({
    stars,
    count,
    total,
}: {
    stars: number
    count: number
    total: number
}) {
    const percentage =
        total > 0 ? Math.round((count / total) * 100) : 0

    return (
        <div className="flex items-center gap-3">
            <span className="w-3 text-xs text-ink-muted">
                {stars}
            </span>

            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <div
                    className="h-full rounded-full bg-gold transition-all"
                    style={{ width: `${percentage}%` }}
                />
            </div>

            <span className="w-8 text-right text-xs text-ink-faint">
                {percentage}%
            </span>
        </div>
    )
}

function WishlistIcon({
    filled,
    size = 18,
}: {
    filled: boolean
    size?: number
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={filled ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
        </svg>
    )
}

export function ProductDetail({
    product,
    rating,
    reviews = [],
    relatedProducts = [],
}: ProductDetailProps) {
    const [activeImage, setActiveImage] = useState(0)

    const [activeTab, setActiveTab] = useState<
        'description' | 'details' | 'shipping'
    >('description')

    const [quantity, setQuantity] = useState(1)

    const {
        isProductWishlisted,
        toggleWishlist,
    } = useWishlist()

    const isWishlisted = isProductWishlisted(product.id)

    const images = [...product.media].sort(
        (a, b) => a.sortOrder - b.sortOrder,
    )

    const averageRating = rating?.averageRating ?? null
    const totalReviews = rating?.totalReviews ?? 0

    const ratingDistribution = rating?.ratingDistribution ?? {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
    }

    const availableStock =
        product.inventory?.availableQuantity ?? 0

    const isOutOfStock = availableStock <= 0

    const isLowStock =
        availableStock > 0 &&
        product.inventory?.lowStockThreshold !== undefined &&
        availableStock <= product.inventory.lowStockThreshold

    const handleWishlistToggle = async () => {
        try {
            await toggleWishlist(product.id)
        } catch (error) {
            console.error('Failed to update wishlist:', error)
        }
    }

    const decreaseQuantity = () => {
        setQuantity((current) => Math.max(1, current - 1))
    }

    const increaseQuantity = () => {
        setQuantity((current) =>
            Math.min(availableStock, current + 1),
        )
    }

    const [cartLoading, setCartLoading] = useState(false)
    const [addedToCart, setAddedToCart] = useState(false)
    const [cartError, setCartError] = useState<string | null>(null)
    const [cartQuantity, setCartQuantity] = useState(0)
    const [cartQuantityLoading, setCartQuantityLoading] = useState(true)

    /*
     * Get the quantity of this product already in the customer's cart.
     *
     * This is NOT a stock reservation. It only prevents this
     * customer from adding more than the currently available
     * quantity and gives the user clear feedback.
     */
    const loadCartQuantity = async () => {
        try {
            const response = await apiRequest<{
                success?: boolean
                data?: {
                    cart?: {
                        items?: Array<{
                            product?: { id?: string }
                            quantity?: number
                        }>
                    }
                    items?: Array<{
                        product?: { id?: string }
                        quantity?: number
                    }>
                }
            }>('/customer/cart')

            const items =
                response.data?.cart?.items ??
                response.data?.items ??
                []

            const currentItem = items.find(
                (item) => item.product?.id === product.id,
            )

            setCartQuantity(
                Math.max(
                    0,
                    Number(currentItem?.quantity) || 0,
                ),
            )
        } catch {
            /*
             * Backend remains the final authority when adding.
             * Keep the product page usable if the cart lookup fails.
             */
        } finally {
            setCartQuantityLoading(false)
        }
    }

    useEffect(() => {
        let mounted = true

        const load = async () => {
            if (!mounted) return
            await loadCartQuantity()
        }

        void load()

        /*
         * If Cart changes this product while Product Detail is
         * mounted, refresh only the current-cart quantity.
         */
        const handleCartUpdated = (event: Event) => {
            const customEvent =
                event as CustomEvent<{
                    source?: 'product-detail' | 'cart'
                }>

            if (customEvent.detail?.source === 'cart') {
                void loadCartQuantity()
            }
        }

        window.addEventListener(
            'ruma:cart-updated',
            handleCartUpdated,
        )

        return () => {
            mounted = false
            window.removeEventListener(
                'ruma:cart-updated',
                handleCartUpdated,
            )
        }
    }, [product.id])

    const maxAddableQuantity = Math.max(
        0,
        availableStock - cartQuantity,
    )

    const cannotAddMore =
        !cartQuantityLoading &&
        maxAddableQuantity <= 0

    const handleAddToCart = async () => {
        if (
            isOutOfStock ||
            cartLoading ||
            cartQuantityLoading
        ) {
            return
        }

        if (quantity > maxAddableQuantity) {
            setCartError(
                cartQuantity > 0
                    ? `You already have ${cartQuantity} in your cart. Only ${maxAddableQuantity} more can be added.`
                    : `Only ${availableStock} items are currently available.`,
            )
            return
        }

        setCartLoading(true)
        setCartError(null)

        /*
         * Header can update immediately.
         * Cart v2 ignores this event as a cart reload signal until
         * the successful backend event below.
         */
        window.dispatchEvent(
            new CustomEvent('ruma:cart-updated', {
                detail: {
                    delta: quantity,
                    source: 'product-detail',
                    syncCart: false,
                },
            }),
        )

        try {
            await apiRequest('/customer/cart/items', {
                method: 'POST',
                body: JSON.stringify({
                    productId: product.id,
                    quantity,
                }),
            })

            setCartQuantity(
                (current) => current + quantity,
            )

            setAddedToCart(true)

            /*
             * Tell a mounted Cart page to reload from the backend
             * now that the POST has definitely succeeded.
             * delta=0 prevents another Header count change.
             */
            window.dispatchEvent(
                new CustomEvent('ruma:cart-updated', {
                    detail: {
                        delta: 0,
                        source: 'product-detail',
                        syncCart: true,
                    },
                }),
            )

            window.setTimeout(() => {
                setAddedToCart(false)
            }, 2000)
        } catch (error) {
            /*
             * Roll back only the Header's optimistic update.
             */
            window.dispatchEvent(
                new CustomEvent('ruma:cart-updated', {
                    detail: {
                        delta: -quantity,
                        source: 'product-detail',
                        syncCart: false,
                    },
                }),
            )

            setCartError(
                error instanceof Error
                    ? error.message
                    : 'Failed to add product to cart.',
            )
        } finally {
            setCartLoading(false)
        }
    }


    return (
        <main className="min-h-screen bg-canvas">
            <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
                {/* Breadcrumb */}
                <nav
                    className="mb-8 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted"
                    aria-label="Breadcrumb"
                >
                    <Link
                        href="/"
                        className="transition-colors hover:text-ink"
                    >
                        Home
                    </Link>

                    <span>/</span>

                    <Link
                        href="/catalogue"
                        className="transition-colors hover:text-ink"
                    >
                        All Products
                    </Link>

                    <span>/</span>

                    <span className="truncate text-ink">
                        {product.name}
                    </span>
                </nav>

                {/* Product Hero */}
                <section className="grid grid-cols-1 gap-10 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
                    {/* Gallery */}
                    <div>
                        <div className="overflow-hidden rounded-xl bg-muted-surface">
                            <div className="aspect-4/5">
                                {images.length > 0 ? (
                                    <img
                                        src={images[activeImage].url}
                                        alt={product.name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-sm text-ink-faint">
                                        No image available
                                    </div>
                                )}
                            </div>
                        </div>

                        {images.length > 1 && (
                            <div className="mt-3 overflow-hidden">
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {images.map((image, index) => (
                                        <button
                                            key={image.id}
                                            type="button"
                                            onClick={() =>
                                                setActiveImage(index)
                                            }
                                            aria-label={`View product image ${index + 1}`}
                                            className={[
                                                'aspect-4/5 w-20 shrink-0 overflow-hidden rounded-lg',
                                                'transition-all duration-200',
                                                index === activeImage
                                                    ? 'ring-2 ring-brand ring-offset-2'
                                                    : 'opacity-60 hover:opacity-90',
                                            ].join(' ')}
                                        >
                                            <img
                                                src={image.url}
                                                alt={`${product.name} view ${index + 1}`}
                                                className="h-full w-full object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Product Information */}
                    <div className="lg:sticky lg:top-24 lg:self-start">
                        <div className="border-b border-line pb-7">
                            {/* Brand + New */}
                            <div className="flex items-center gap-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
                                    {product.brand.name}
                                </p>

                                {product.isNew && (
                                    <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-brand">
                                        New
                                    </span>
                                )}
                            </div>

                            <h1
                                className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl"
                                style={{
                                    fontFamily:
                                        'var(--font-fraunces), Georgia, serif',
                                }}
                            >
                                {product.name}
                            </h1>

                            {/* Rating */}
                            <div className="mt-4 flex items-center gap-2">
                                {averageRating !== null ? (
                                    <>
                                        <RatingStars
                                            rating={averageRating}
                                        />

                                        <span className="text-sm font-semibold text-ink">
                                            {averageRating.toFixed(1)}
                                        </span>

                                        <span className="text-sm text-ink-muted">
                                            {totalReviews}{' '}
                                            {totalReviews === 1
                                                ? 'review'
                                                : 'reviews'}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-sm text-ink-muted">
                                        No reviews yet
                                    </span>
                                )}
                            </div>

                            {/* Price */}
                            <p className="mt-6 text-3xl font-semibold tracking-tight text-ink">
                                {formatPrice(product.price)}
                            </p>
                        </div>

                        {/* Stock */}
                        <div className="border-b border-line py-6">
                            <div
                                className={[
                                    'flex items-center justify-between rounded-xl border p-4',
                                    isOutOfStock
                                        ? 'border-red-200 bg-red-50'
                                        : isLowStock
                                            ? 'border-amber-200 bg-amber-50'
                                            : 'border-line bg-muted-surface/50',
                                ].join(' ')}
                            >
                                <div className="flex items-center gap-3">
                                    <span
                                        className={[
                                            'flex h-9 w-9 items-center justify-center rounded-full',
                                            isOutOfStock
                                                ? 'bg-red-100 text-red-600'
                                                : isLowStock
                                                    ? 'bg-amber-100 text-amber-600'
                                                    : 'bg-green-100 text-green-600',
                                        ].join(' ')}
                                    >
                                        {isOutOfStock ? (
                                            <svg
                                                width="17"
                                                height="17"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                            >
                                                <circle
                                                    cx="12"
                                                    cy="12"
                                                    r="9"
                                                />
                                                <path d="m9 9 6 6" />
                                                <path d="m15 9-6 6" />
                                            </svg>
                                        ) : (
                                            <svg
                                                width="17"
                                                height="17"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                            >
                                                <path d="M20 6 9 17l-5-5" />
                                            </svg>
                                        )}
                                    </span>

                                    <div>
                                        <p className="text-sm font-semibold text-ink">
                                            {isOutOfStock
                                                ? 'Out of stock'
                                                : isLowStock
                                                    ? 'Low stock'
                                                    : 'In stock'}
                                        </p>

                                        <p className="mt-0.5 text-xs text-ink-muted">
                                            {isOutOfStock
                                                ? 'This product is currently unavailable'
                                                : `${availableStock} items available`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Purchase */}
                        <div className="space-y-4 py-6">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-ink">
                                    Quantity
                                </span>

                                <div className="flex items-center rounded-lg border border-line">
                                    <button
                                        type="button"
                                        onClick={decreaseQuantity}
                                        disabled={
                                            isOutOfStock ||
                                            quantity <= 1
                                        }
                                        className="flex h-10 w-10 items-center justify-center text-lg text-ink transition-colors hover:bg-muted-surface disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label="Decrease quantity"
                                    >
                                        −
                                    </button>

                                    <span className="flex h-10 min-w-10 items-center justify-center border-x border-line px-3 text-sm font-semibold text-ink">
                                        {quantity}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={increaseQuantity}
                                        disabled={
                                            isOutOfStock ||
                                            quantity >= availableStock
                                        }
                                        className="flex h-10 w-10 items-center justify-center text-lg text-ink transition-colors hover:bg-muted-surface disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label="Increase quantity"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleAddToCart}
                                disabled={
                                    isOutOfStock ||
                                    cartLoading ||
                                    cartQuantityLoading ||
                                    cannotAddMore
                                }
                                className={[
                                    'h-12 w-full rounded-lg px-6 text-sm font-semibold',
                                    'transition-colors duration-200',
                                    'disabled:cursor-not-allowed disabled:opacity-40',
                                    addedToCart
                                        ? 'bg-brand text-white'
                                        : 'bg-brand text-white hover:bg-brand-dark',
                                ].join(' ')}
                            >
                                {isOutOfStock ? (
                                    'Out of Stock'
                                ) : cartQuantityLoading ? (
                                    'Checking cart...'
                                ) : cannotAddMore ? (
                                    'Maximum quantity in cart'
                                ) : cartLoading ? (
                                    'Adding...'
                                ) : addedToCart ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg>
                                        Added to cart
                                    </span>
                                ) : (
                                    'Add to cart'
                                )}
                            </button>

                            {cartQuantity > 0 && (
                                <p className="text-xs leading-relaxed text-ink-muted">
                                    You already have{' '}
                                    <span className="font-medium text-ink">
                                        {cartQuantity}
                                    </span>{' '}
                                    in your cart.
                                    {maxAddableQuantity > 0
                                        ? ` You can add up to ${maxAddableQuantity} more.`
                                        : ' You have reached the currently available quantity.'}
                                </p>
                            )}

                            {cartError && (
                                <p
                                    role="alert"
                                    className="text-xs leading-relaxed text-red-600"
                                >
                                    {cartError}
                                </p>
                            )}

                            <button
                                type="button"
                                onClick={handleWishlistToggle}
                                className={[
                                    'flex h-12 w-full items-center justify-center gap-2 rounded-lg border',
                                    'text-sm font-medium transition-colors',
                                    isWishlisted
                                        ? 'border-brand bg-brand/5 text-brand'
                                        : 'border-line text-ink-sub hover:border-line-strong hover:text-ink',
                                ].join(' ')}
                                aria-label={
                                    isWishlisted
                                        ? `Remove ${product.name} from wishlist`
                                        : `Add ${product.name} to wishlist`
                                }
                            >
                                <WishlistIcon
                                    filled={isWishlisted}
                                />

                                {isWishlisted
                                    ? 'Saved to wishlist'
                                    : 'Save to wishlist'}
                            </button>
                        </div>

                        {/* Product Meta */}
                        <div className="border-t border-line pt-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-ink-muted">
                                    SKU
                                </span>

                                <span className="font-mono text-xs text-ink-sub">
                                    {product.sku}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Product Information Tabs */}
                <section className="border-t border-line py-12">
                    <div className="border-b border-line">
                        <div className="flex gap-6 overflow-x-auto">
                            {(
                                [
                                    'description',
                                    'details',
                                    'shipping',
                                ] as const
                            ).map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() =>
                                        setActiveTab(tab)
                                    }
                                    className={[
                                        'relative shrink-0 pb-4 text-sm font-medium capitalize transition-colors',
                                        activeTab === tab
                                            ? 'text-brand'
                                            : 'text-ink-muted hover:text-ink',
                                    ].join(' ')}
                                >
                                    {tab}

                                    {activeTab === tab && (
                                        <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    {activeTab === 'description' && (
                        <div className="max-w-3xl pt-7">
                            <h2
                                className="text-xl font-semibold text-ink"
                                style={{
                                    fontFamily:
                                        'var(--font-fraunces), Georgia, serif',
                                }}
                            >
                                About this product
                            </h2>

                            <p className="mt-4 text-sm leading-7 text-ink-sub">
                                {product.description ||
                                    'No product description available.'}
                            </p>
                        </div>
                    )}

                    {/* Specifications */}
                    {activeTab === 'details' && (
                        <div className="pt-7">
                            <div className="max-w-3xl">
                                <h2
                                    className="text-xl font-semibold text-ink"
                                    style={{
                                        fontFamily:
                                            'var(--font-fraunces), Georgia, serif',
                                    }}
                                >
                                    Product specifications
                                </h2>

                                <p className="mt-2 text-sm text-ink-muted">
                                    Product information and current
                                    availability.
                                </p>
                            </div>

                            <div className="mt-6 max-w-3xl overflow-hidden rounded-xl border border-line">
                                <div className="divide-y divide-line">
                                    <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-[180px_1fr]">
                                        <span className="text-sm text-ink-muted">
                                            Category
                                        </span>

                                        <span className="text-right text-sm font-medium text-ink sm:text-left">
                                            {product.category.name}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-[180px_1fr]">
                                        <span className="text-sm text-ink-muted">
                                            Brand
                                        </span>

                                        <span className="text-right text-sm font-medium text-ink sm:text-left">
                                            {product.brand.name}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-[180px_1fr]">
                                        <span className="text-sm text-ink-muted">
                                            Supplier
                                        </span>

                                        <span className="text-right text-sm font-medium text-ink sm:text-left">
                                            {product.supplier.name}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-[180px_1fr]">
                                        <span className="text-sm text-ink-muted">
                                            Availability
                                        </span>

                                        <span className="text-right text-sm font-medium text-ink sm:text-left">
                                            {isOutOfStock
                                                ? 'Out of stock'
                                                : `${availableStock} items available`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* SKU */}
                            <div className="mt-4 flex max-w-3xl items-center justify-between gap-4">
                                <span className="text-xs text-ink-faint">
                                    SKU
                                </span>

                                <span className="font-mono text-xs text-ink-muted">
                                    {product.sku}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Shipping */}
                    {activeTab === 'shipping' && (
                        <div className="max-w-3xl pt-7">
                            <h2
                                className="text-xl font-semibold text-ink"
                                style={{
                                    fontFamily:
                                        'var(--font-fraunces), Georgia, serif',
                                }}
                            >
                                Shipping information
                            </h2>

                            <p className="mt-4 text-sm leading-7 text-ink-sub">
                                Shipping options and delivery estimates
                                will be available during checkout.
                            </p>

                            <div className="mt-6 rounded-xl border border-line bg-muted-surface/40 p-5">
                                <div className="flex gap-3">
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.75"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="mt-0.5 shrink-0 text-brand"
                                        aria-hidden="true"
                                    >
                                        <rect
                                            width="16"
                                            height="13"
                                            x="4"
                                            y="3"
                                            rx="2"
                                        />
                                        <path d="M8 21h8" />
                                        <path d="M12 16v5" />
                                    </svg>

                                    <div>
                                        <p className="text-sm font-medium text-ink">
                                            Delivery options
                                        </p>

                                        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                                            Available courier services,
                                            shipping rates, and delivery
                                            estimates are calculated
                                            during checkout.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Reviews */}
                <section className="border-t border-line py-12">
                    <h2
                        className="mb-8 text-xl font-semibold text-ink"
                        style={{
                            fontFamily:
                                'var(--font-fraunces), Georgia, serif',
                        }}
                    >
                        Customer reviews
                    </h2>

                    <div className="flex flex-col gap-10 md:flex-row">
                        {/* Rating Summary */}
                        <div className="md:w-64 md:shrink-0">
                            <div className="text-4xl font-bold text-ink">
                                {averageRating !== null
                                    ? averageRating.toFixed(1)
                                    : '—'}
                            </div>

                            {averageRating !== null && (
                                <div className="mt-2">
                                    <RatingStars
                                        rating={averageRating}
                                        size={14}
                                    />
                                </div>
                            )}

                            <p className="mt-2 text-xs text-ink-muted">
                                Based on {totalReviews} reviews
                            </p>

                            <div className="mt-5 space-y-2">
                                {[5, 4, 3, 2, 1].map((stars) => (
                                    <RatingBar
                                        key={stars}
                                        stars={stars}
                                        count={
                                            ratingDistribution[
                                            stars as keyof typeof ratingDistribution
                                            ]
                                        }
                                        total={totalReviews}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Reviews List */}
                        <div className="flex-1">
                            {reviews.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-muted">
                                    No reviews yet.
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {reviews.map((review) => (
                                        <article
                                            key={review.id}
                                            className="border-b border-line pb-6 last:border-b-0"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <RatingStars
                                                        rating={
                                                            review.rating
                                                        }
                                                        size={12}
                                                    />

                                                    <p className="mt-2 text-sm font-semibold text-ink">
                                                        {
                                                            review.user
                                                                .fullName
                                                        }
                                                    </p>
                                                </div>

                                                <time className="text-xs text-ink-faint">
                                                    {new Intl.DateTimeFormat(
                                                        'en-US',
                                                        {
                                                            dateStyle:
                                                                'medium',
                                                        },
                                                    ).format(
                                                        new Date(
                                                            review.createdAt,
                                                        ),
                                                    )}
                                                </time>
                                            </div>

                                            {review.reviewText && (
                                                <p className="mt-3 text-sm leading-relaxed text-ink-sub">
                                                    {review.reviewText}
                                                </p>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <section className="border-t border-line py-12">
                        <h2
                            className="mb-7 text-xl font-semibold text-ink"
                            style={{
                                fontFamily:
                                    'var(--font-fraunces), Georgia, serif',
                            }}
                        >
                            You may also like
                        </h2>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
                            {relatedProducts.map((related) => {
                                const relatedImage = [
                                    ...related.media,
                                ].sort(
                                    (a, b) =>
                                        a.sortOrder - b.sortOrder,
                                )[0]

                                return (
                                    <Link
                                        key={related.id}
                                        href={`/product/${related.slug}`}
                                        className="group"
                                    >
                                        <div className="aspect-4/5 overflow-hidden rounded-xl bg-muted-surface">
                                            {relatedImage ? (
                                                <img
                                                    src={relatedImage.url}
                                                    alt={related.name}
                                                    loading="lazy"
                                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center text-xs text-ink-faint">
                                                    No image
                                                </div>
                                            )}
                                        </div>

                                        <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.18em] text-brand">
                                            {related.brand.name}
                                        </p>

                                        <p className="mt-1 text-sm font-medium leading-snug text-ink transition-colors group-hover:text-brand">
                                            {related.name}
                                        </p>

                                        <p className="mt-1 text-sm font-semibold text-ink">
                                            {formatPrice(
                                                related.price,
                                            )}
                                        </p>
                                    </Link>
                                )
                            })}
                        </div>
                    </section>
                )}
            </div>
        </main>
    )
}