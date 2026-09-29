'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
    getCart,
    removeCartItem,
    updateCartItemSelection,
    updateCartQuantity,
    type CartItem,
    type CustomerCart,
} from '@/api/cart'

import { getProducts } from '@/api/products'

function formatPrice(price: number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(price)
}

const BRAND_GREEN = '#28684f'

export default function Cart() {
    const router = useRouter()

    const [cart, setCart] = useState<CustomerCart | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    /*
     * Stock errors belong to individual cart items, not the
     * whole cart. This lets us show the error directly under
     * the affected product like the Figma Make state.
     */
    const [stockErrors, setStockErrors] = useState<
        Record<string, string>
    >({})

    const [updatingItemId, setUpdatingItemId] =
        useState<string | null>(null)

    /*
     * Cart API currently returns product id/name/brand/imageUrl,
     * while the frontend product detail route uses product slug.
     *
     * Keep a lightweight product slug map here.
     */
    const [productSlugs, setProductSlugs] = useState<
        Record<string, string>
    >({})

    /* ========================================================= */
    /* Error helpers                                               */
    /* ========================================================= */

    function getStockErrorMessage(
        error: unknown,
    ): string {
        const message =
            error instanceof Error
                ? error.message
                : ''

        const match = message.match(
            /available(?: quantity)?\s*:\s*(\d+)/i,
        )

        if (match) {
            return `Only ${match[1]} items are currently available.`
        }

        if (
            /insufficient stock|stock/i.test(message)
        ) {
            return 'The requested quantity is no longer available.'
        }

        return message || 'Failed to update quantity.'
    }

    function clearStockError(cartItemId: string) {
        setStockErrors((current) => {
            if (!(cartItemId in current)) {
                return current
            }

            const next = { ...current }
            delete next[cartItemId]
            return next
        })
    }

    /* ========================================================= */
    /* Load cart                                                  */
    /* ========================================================= */

    async function loadCart() {
        try {
            setLoading(true)
            setError(null)

            const response = await getCart()

            setCart(response)
            setStockErrors({})
        } catch {
            setError(
                'Something went wrong while loading your cart. Please try again.',
            )
        } finally {
            setLoading(false)
        }
    }

    /* ========================================================= */
    /* Initial load + cart synchronization                         */
    /* ========================================================= */

    useEffect(() => {
        void loadCart()

        /*
         * Synchronize only changes that originate outside this Cart.
         *
         * Cart quantity/remove actions already update local state
         * optimistically, so they must NOT trigger another full
         * cart reload or loading skeleton.
         *
         * Product Detail, however, can change the cart while this
         * page is mounted, so that source should refresh from the
         * backend.
         */
        const handleCartUpdated = (event: Event) => {
            const customEvent =
                event as CustomEvent<{
                    source?: 'product-detail' | 'cart'
                    syncCart?: boolean
                }>

            /*
             * Product Detail sends one optimistic event for the
             * Header, then a second event after the backend POST
             * succeeds. Only the second event should reload Cart.
             */
            if (
                customEvent.detail?.source ===
                    'product-detail' &&
                customEvent.detail?.syncCart === true
            ) {
                void loadCart()
            }
        }

        window.addEventListener(
            'ruma:cart-updated',
            handleCartUpdated,
        )

        return () => {
            window.removeEventListener(
                'ruma:cart-updated',
                handleCartUpdated,
            )
        }
    }, [])

    /* ========================================================= */
    /* Load product slugs                                         */
    /* ========================================================= */

    useEffect(() => {
        let mounted = true

        async function loadProductSlugs() {
            try {
                const products = await getProducts()

                if (!mounted) {
                    return
                }

                const slugMap: Record<string, string> = {}

                for (const product of products) {
                    slugMap[product.id] = product.slug
                }

                setProductSlugs(slugMap)
            } catch (err) {
                console.error(
                    'Failed to load product slugs:',
                    err,
                )
            }
        }

        void loadProductSlugs()

        return () => {
            mounted = false
        }
    }, [])

    /* ========================================================= */
    /* Derived state                                              */
    /* ========================================================= */

    const items = cart?.items ?? []

    const selectedItems = useMemo(
        () => items.filter((item) => item.isSelected),
        [items],
    )

    const selectedSubtotal = useMemo(
        () =>
            selectedItems.reduce(
                (total, item) => total + item.subtotal,
                0,
            ),
        [selectedItems],
    )

    const allSelected =
        items.length > 0 &&
        items.every((item) => item.isSelected)

    const someSelected =
        items.some((item) => item.isSelected) &&
        !allSelected

    /* ========================================================= */
    /* Helpers                                                    */
    /* ========================================================= */

    function getProductSlug(item: CartItem) {
        return productSlugs[item.product.id]
    }

    function openProduct(item: CartItem) {
        const slug = getProductSlug(item)

        if (!slug) {
            console.warn(
                'Product slug not available:',
                item.product.id,
            )
            return
        }

        router.push(`/product/${slug}`)
    }

    /* ========================================================= */
    /* Selection                                                  */
    /* ========================================================= */

    async function handleSelectionChange(
        item: CartItem,
        nextSelected: boolean,
    ) {
        if (!cart) {
            return
        }

        const previousCart = cart

        /*
         * IMPORTANT:
         * Update local UI immediately.
         *
         * Do NOT wait for GET / refresh.
         * This prevents the previous "Your cart is empty"
         * flicker/state replacement bug.
         */
        const optimisticCart: CustomerCart = {
            ...cart,
            items: cart.items.map((currentItem) =>
                currentItem.cartItemId === item.cartItemId
                    ? {
                        ...currentItem,
                        isSelected: nextSelected,
                    }
                    : currentItem,
            ),
        }

        setCart(optimisticCart)
        setUpdatingItemId(item.cartItemId)
        setError(null)
        clearStockError(item.cartItemId)

        try {
            const response =
                await updateCartItemSelection(
                    item.cartItemId,
                    nextSelected,
                )

            /*
             * Only merge the server response if it is a
             * valid cart response.
             *
             * If the backend returns an unexpected shape,
             * keep our optimistic local state instead of
             * replacing the UI with an empty/undefined cart.
             */
            if (response && Array.isArray(response.items)) {
                setCart(response)
            }

        } catch (err) {
            console.error(
                'Failed to update cart selection:',
                err,
            )

            // Roll back only when the API actually fails.
            setCart(previousCart)

            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to update item selection.',
            )
        } finally {
            setUpdatingItemId(null)
        }
    }

    /* ========================================================= */
    /* Select all                                                 */
    /* ========================================================= */

    async function handleSelectAll() {
        if (!cart || items.length === 0) {
            return
        }

        const nextSelected = !allSelected
        const previousCart = cart

        const optimisticCart: CustomerCart = {
            ...cart,
            items: cart.items.map((item) => ({
                ...item,
                isSelected: nextSelected,
            })),
        }

        setCart(optimisticCart)
        setError(null)

        setStockErrors((current) => {
            if (Object.keys(current).length === 0) {
                return current
            }

            const next = { ...current }
            for (const item of items) {
                delete next[item.cartItemId]
            }
            return next
        })

        try {
            /*
             * Only update items whose state actually changes.
             */
            const itemsToUpdate = items.filter(
                (item) =>
                    item.isSelected !== nextSelected,
            )

            /*
             * Run requests in parallel instead of sequentially
             * updating the UI after every request.
             */
            const responses = await Promise.all(
                itemsToUpdate.map((item) =>
                    updateCartItemSelection(
                        item.cartItemId,
                        nextSelected,
                    ),
                ),
            )

            /*
             * Use the last valid server cart.
             */
            const validResponse = [...responses]
                .reverse()
                .find(
                    (response) =>
                        response &&
                        Array.isArray(response.items),
                )

            if (validResponse) {
                setCart(validResponse)
            }

        } catch (err) {
            console.error(
                'Failed to update all cart selections:',
                err,
            )

            setCart(previousCart)

            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to update cart selection.',
            )
        }
    }

    /* ========================================================= */
    /* Quantity                                                   */
    /* ========================================================= */

    async function handleQuantityChange(
        item: CartItem,
        nextQuantity: number,
    ) {
        if (!cart) {
            return
        }

        if (nextQuantity < 1) {
            return
        }

        if (updatingItemId) {
            return
        }

        const previousCart = cart

        /*
         * Optimistic update.
         *
         * UI berubah langsung tanpa menunggu response API.
         */
        const optimisticCart: CustomerCart = {
            ...cart,
            items: cart.items.map((currentItem) =>
                currentItem.cartItemId === item.cartItemId
                    ? {
                        ...currentItem,
                        quantity: nextQuantity,
                        subtotal:
                            currentItem.pricing.finalPrice *
                            nextQuantity,
                    }
                    : currentItem,
            ),
        }

        setCart(optimisticCart)
        setUpdatingItemId(item.cartItemId)
        setError(null)
        clearStockError(item.cartItemId)

        try {
            const response = await updateCartQuantity(
                item.cartItemId,
                nextQuantity,
            )

            /*
             * Gunakan response backend kalau bentuknya
             * valid.
             */
            if (
                response &&
                Array.isArray(response.items)
            ) {
                setCart(response)
            }

            /*
             * Beritahu Header dan Cart lain bahwa cart berubah.
             * Delta dihitung dari quantity sebelum optimistic update.
             */
            window.dispatchEvent(
                new CustomEvent('ruma:cart-updated', {
                    detail: {
                        delta: nextQuantity - item.quantity,
                        source: 'cart',
                    },
                }),
            )
        } catch (err) {
            /*
             * Quantity is rolled back, while the stock message
             * is attached only to the affected cart item.
             */
            setCart(previousCart)

            const message =
                getStockErrorMessage(err)

            if (
                /available|stock/i.test(message)
            ) {
                setStockErrors((current) => ({
                    ...current,
                    [item.cartItemId]: message,
                }))
            } else {
                setError(message)
            }
        } finally {
            setUpdatingItemId(null)
        }
    }

    /* ========================================================= */
    /* Remove                                                     */
    /* ========================================================= */

    async function handleRemove(item: CartItem) {
        if (updatingItemId) {
            return
        }

        const previousCart = cart

        if (!previousCart) {
            return
        }

        /*
         * Optimistic remove.
         */
        setCart({
            ...previousCart,
            items: previousCart.items.filter(
                (currentItem) =>
                    currentItem.cartItemId !==
                    item.cartItemId,
            ),
        })

        setUpdatingItemId(item.cartItemId)
        setError(null)
        clearStockError(item.cartItemId)

        try {
            const response = await removeCartItem(
                item.cartItemId,
            )

            if (response && Array.isArray(response.items)) {
                setCart(response)
            }

            /*
             * Beritahu Header dan Cart lain bahwa cart berubah.
             * Quantity item yang dihapus menjadi delta negatif.
             */
            window.dispatchEvent(
                new CustomEvent('ruma:cart-updated', {
                    detail: {
                        delta: -item.quantity,
                        source: 'cart',
                    },
                }),
            )
        } catch (err) {
            /*
             * Jangan console.error untuk business/API error
             * yang memang sudah ditampilkan melalui UI.
             */

            setCart(previousCart)

            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to remove cart item.',
            )
        } finally {
            setUpdatingItemId(null)
        }
    }

    /* ========================================================= */
    /* Loading                                                    */
    /* ========================================================= */

    if (loading) {
        return (
            <main className="min-h-[60vh] bg-canvas">
                <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
                    <div className="animate-pulse">
                        <div className="h-8 w-48 rounded bg-muted" />

                        <div className="mt-8 h-20 rounded border border-line bg-white" />

                        <div className="mt-4 h-32 rounded border border-line bg-white" />
                    </div>
                </div>
            </main>
        )
    }

    /* ========================================================= */
    /* Error                                                      */
    /* ========================================================= */

    if (error && !cart) {
        return (
            <main className="min-h-[60vh] bg-canvas">
                <div className="mx-auto max-w-7xl px-5 py-12 text-center sm:px-8 lg:px-10">
                    <h1
                        className="text-2xl font-semibold text-ink"
                        style={{
                            fontFamily:
                                'var(--font-fraunces), Georgia, serif',
                        }}
                    >
                        Could not load your cart
                    </h1>

                    <p className="mt-3 text-sm text-ink-muted">
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() => void loadCart()}
                        className="mt-6 rounded-md bg-brand px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
                    >
                        Try Again
                    </button>
                </div>
            </main>
        )
    }

    /* ========================================================= */
    /* Empty                                                       */
    /* ========================================================= */

    if (items.length === 0) {
        return (
            <main className="min-h-[60vh] bg-canvas">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-5 py-20 text-center sm:px-8 lg:px-10">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white">
                        <svg
                            width="25"
                            height="25"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className="text-ink-muted"
                        >
                            <path d="M3 3h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 7H6" />
                            <circle cx="10" cy="19" r="1" />
                            <circle cx="18" cy="19" r="1" />
                        </svg>
                    </div>

                    <h1
                        className="mt-6 text-2xl font-semibold tracking-tight text-ink"
                        style={{
                            fontFamily:
                                'var(--font-fraunces), Georgia, serif',
                        }}
                    >
                        Your cart is empty
                    </h1>

                    <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
                        Add products to your cart and they
                        will appear here.
                    </p>

                    <Link
                        href="/catalogue"
                        className="mt-7 rounded-md bg-brand px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
                    >
                        Continue Shopping
                    </Link>
                </div>
            </main>
        )
    }

    /* ========================================================= */
    /* Main                                                        */
    /* ========================================================= */

    return (
        <main className="min-h-screen bg-canvas">
            <div className="mx-auto w-full max-w-7xl px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
                {/* Header */}
                <div className="mb-7 flex items-end justify-between gap-4">
                    <div>
                        <div className="flex items-baseline gap-3">
                            <h1
                                className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
                                style={{
                                    fontFamily:
                                        'var(--font-fraunces), Georgia, serif',
                                }}
                            >
                                Shopping Cart
                            </h1>

                            <span className="text-sm text-ink-muted">
                                {items.length}{' '}
                                {items.length === 1
                                    ? 'item'
                                    : 'items'}
                            </span>
                        </div>
                    </div>

                    <Link
                        href="/catalogue"
                        className="hidden text-sm text-brand transition-colors hover:text-brand-dark sm:block"
                    >
                        Continue Shopping
                    </Link>
                </div>

                {error && (
                    <div
                        role="alert"
                        className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                        {error}
                    </div>
                )}

                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
                    {/* Cart items */}
                    <section>
                        {/* Select all */}
                        <div className="flex items-center justify-between border-b border-line pb-4">
                            <button
                                type="button"
                                onClick={() =>
                                    void handleSelectAll()
                                }
                                className="flex items-center gap-3 text-sm text-ink"
                                aria-pressed={allSelected}
                            >
                                <span
                                    className={`flex h-4.5 w-4.5 items-center justify-center rounded-[3px] border transition-colors ${allSelected ||
                                        someSelected
                                        ? 'border-brand bg-brand text-white'
                                        : 'border-line bg-white'
                                        }`}
                                    style={
                                        allSelected ||
                                            someSelected
                                            ? {
                                                backgroundColor:
                                                    BRAND_GREEN,
                                                borderColor:
                                                    BRAND_GREEN,
                                            }
                                            : undefined
                                    }
                                >
                                    {allSelected && (
                                        <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                        >
                                            <path d="m5 12 4 4L19 6" />
                                        </svg>
                                    )}

                                    {!allSelected &&
                                        someSelected && (
                                            <span className="h-0.5 w-2.5 bg-white" />
                                        )}
                                </span>

                                <span>Select all</span>
                            </button>

                            <span className="text-sm text-ink-muted">
                                {selectedItems.length}{' '}
                                selected
                            </span>
                        </div>

                        {/* Items */}
                        <div className="divide-y divide-line">
                            {items.map((item) => {
                                const isUpdating =
                                    updatingItemId ===
                                    item.cartItemId

                                const slug =
                                    getProductSlug(item)

                                return (
                                    <article
                                        key={
                                            item.cartItemId
                                        }
                                        className="flex gap-4 py-5 sm:gap-5"
                                    >
                                        {/* Selection */}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void handleSelectionChange(
                                                    item,
                                                    !item.isSelected,
                                                )
                                            }
                                            disabled={
                                                isUpdating
                                            }
                                            aria-label={
                                                item.isSelected
                                                    ? `Deselect ${item.product.name}`
                                                    : `Select ${item.product.name}`
                                            }
                                            className="mt-1 shrink-0"
                                        >
                                            <span
                                                className={`flex h-4.5 w-4.5 items-center justify-center rounded-[3px] border transition-colors ${item.isSelected
                                                    ? 'border-brand bg-brand text-white'
                                                    : 'border-line bg-white'
                                                    }`}
                                                style={
                                                    item.isSelected
                                                        ? {
                                                            backgroundColor:
                                                                BRAND_GREEN,
                                                            borderColor:
                                                                BRAND_GREEN,
                                                        }
                                                        : undefined
                                                }
                                            >
                                                {item.isSelected && (
                                                    <svg
                                                        width="12"
                                                        height="12"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="3"
                                                    >
                                                        <path d="m5 12 4 4L19 6" />
                                                    </svg>
                                                )}
                                            </span>
                                        </button>

                                        {/* Product image */}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openProduct(
                                                    item,
                                                )
                                            }
                                            disabled={!slug}
                                            className={`h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted-surface text-left sm:h-28 sm:w-28 ${slug
                                                ? 'cursor-pointer'
                                                : 'cursor-default'
                                                }`}
                                            aria-label={`View ${item.product.name}`}
                                        >
                                            {item.product
                                                .imageUrl ? (
                                                <img
                                                    src={
                                                        item
                                                            .product
                                                            .imageUrl
                                                    }
                                                    alt={
                                                        item
                                                            .product
                                                            .name
                                                    }
                                                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center text-xs text-ink-faint">
                                                    No image
                                                </div>
                                            )}
                                        </button>

                                        {/* Product information */}
                                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-brand">
                                                    {
                                                        item
                                                            .product
                                                            .brand
                                                    }
                                                </p>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openProduct(
                                                            item,
                                                        )
                                                    }
                                                    disabled={!slug}
                                                    className="mt-1 block max-w-full truncate text-left text-base font-medium text-ink transition-colors hover:text-brand disabled:cursor-default disabled:hover:text-ink"
                                                >
                                                    {
                                                        item
                                                            .product
                                                            .name
                                                    }
                                                </button>

                                                <p className="mt-2 text-sm text-ink">
                                                    {formatPrice(
                                                        item
                                                            .pricing
                                                            .finalPrice,
                                                    )}
                                                </p>
                                            </div>

                                            <div className="mt-4 flex flex-wrap items-center gap-4">
                                                {/* Quantity */}
                                                <div className="flex h-9 items-center overflow-hidden rounded-md border border-line bg-white">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void handleQuantityChange(
                                                                item,
                                                                item.quantity -
                                                                1,
                                                            )
                                                        }
                                                        disabled={
                                                            isUpdating ||
                                                            item.quantity <=
                                                            1
                                                        }
                                                        className="flex h-full w-9 items-center justify-center text-ink-muted transition-colors hover:bg-muted-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                                                        aria-label="Decrease quantity"
                                                    >
                                                        −
                                                    </button>

                                                    <span className="flex h-full min-w-9 items-center justify-center border-x border-line px-2 text-sm text-ink">
                                                        {
                                                            item.quantity
                                                        }
                                                    </span>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void handleQuantityChange(
                                                                item,
                                                                item.quantity +
                                                                1,
                                                            )
                                                        }
                                                        disabled={
                                                            isUpdating
                                                        }
                                                        className="flex h-full w-9 items-center justify-center text-ink-muted transition-colors hover:bg-muted-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                                                        aria-label="Increase quantity"
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                {/* Remove */}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void handleRemove(
                                                            item,
                                                        )
                                                    }
                                                    disabled={
                                                        isUpdating
                                                    }
                                                    className="text-xs text-ink-muted transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Remove
                                                </button>
                                            </div>

                                            {stockErrors[
                                                item.cartItemId
                                            ] && (
                                                <p
                                                    role="alert"
                                                    className="mt-3 flex items-center gap-1.5 text-xs text-red-600"
                                                >
                                                    <svg
                                                        width="13"
                                                        height="13"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="1.8"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        aria-hidden="true"
                                                    >
                                                        <path d="M12 9v4" />
                                                        <path d="M12 17h.01" />
                                                        <circle
                                                            cx="12"
                                                            cy="12"
                                                            r="9"
                                                        />
                                                    </svg>
                                                    {
                                                        stockErrors[
                                                            item.cartItemId
                                                        ]
                                                    }
                                                </p>
                                            )}
                                        </div>

                                        {/* Right price */}
                                        <div className="hidden shrink-0 text-right sm:block">
                                            <p className="text-sm font-medium text-ink">
                                                {formatPrice(
                                                    item.subtotal,
                                                )}
                                            </p>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>

                        {/* Mobile continue shopping */}
                        <div className="pt-5 sm:hidden">
                            <Link
                                href="/catalogue"
                                className="text-sm text-brand"
                            >
                                ← Continue Shopping
                            </Link>
                        </div>
                    </section>

                    {/* Summary */}
                    <aside className="lg:sticky lg:top-6 lg:self-start">
                        <div className="border border-line bg-white p-6">
                            <h2 className="text-base font-semibold text-ink">
                                Cart Summary
                            </h2>

                            <div className="mt-6 space-y-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-ink-muted">
                                        Items selected
                                    </span>

                                    <span className="font-medium text-ink">
                                        {
                                            selectedItems.length
                                        }{' '}
                                        / {items.length}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-ink-muted">
                                        Subtotal
                                    </span>

                                    <span className="font-semibold text-ink">
                                        {formatPrice(
                                            selectedSubtotal,
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div className="my-5 border-t border-line" />

                            <p className="text-xs leading-relaxed text-ink-muted">
                                Shipping and final checkout
                                pricing will be calculated
                                during checkout.
                            </p>

                            <button
                                type="button"
                                disabled={
                                    selectedItems.length ===
                                    0
                                }
                                className="mt-5 flex h-11 w-full items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
                                onClick={() => {
                                    if (
                                        selectedItems.length >
                                        0
                                    ) {
                                        router.push(
                                            '/checkout',
                                        )
                                    }
                                }}
                            >
                                Proceed to Checkout
                                {selectedItems.length >
                                    0 && (
                                        <>
                                            <span className="mx-1.5 opacity-70">
                                                ·
                                            </span>
                                            {formatPrice(
                                                selectedSubtotal,
                                            )}
                                        </>
                                    )}
                            </button>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    )
}