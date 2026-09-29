'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { apiRequest } from '@/api/client'
import { useWishlist } from '@/components/providers/WishlistProvider'

interface CartItemResponse {
    quantity: number
}

interface CartApiResponse {
    success: boolean
    message?: string
    data?: {
        cart?: {
            items?: CartItemResponse[]
        }
        items?: CartItemResponse[]
    }
}

function getCartItems(response: CartApiResponse): CartItemResponse[] {
    return (
        response.data?.cart?.items ??
        response.data?.items ??
        []
    )
}

export function Header() {
    const router = useRouter()

    const { wishlistCount } =
        useWishlist()

    const [searchQuery, setSearchQuery] =
        useState('')

    const [mobileSearchOpen, setMobileSearchOpen] =
        useState(false)

    const [cartCount, setCartCount] =
        useState(0)

    const [cartLoading, setCartLoading] =
        useState(true)

    const loadCartCount = async () => {
        try {
            const response =
                await apiRequest<CartApiResponse>(
                    '/customer/cart',
                )

            const items = getCartItems(response)

            const totalQuantity = items.reduce(
                (total, item) =>
                    total +
                    Math.max(
                        0,
                        Number(item.quantity) || 0,
                    ),
                0,
            )

            setCartCount(totalQuantity)
        } catch (error) {
            console.error(
                'Failed to load cart count:',
                error,
            )

            setCartCount(0)
        } finally {
            setCartLoading(false)
        }
    }

    useEffect(() => {
        void loadCartCount()

        /*
         * Cart components can dispatch this event after:
         * - Add to Cart
         * - Update quantity
         * - Remove item
         * - Change selection
         */
        const handleCartUpdated = (event: Event) => {
            const customEvent =
                event as CustomEvent<{
                    totalQuantity?: number
                    delta?: number
                }>

            const {
                totalQuantity,
                delta,
            } = customEvent.detail ?? {}

            // Used when the full cart quantity is known.
            if (
                typeof totalQuantity === 'number' &&
                Number.isFinite(totalQuantity)
            ) {
                setCartCount(totalQuantity)
                setCartLoading(false)
                return
            }

            // Used for instant optimistic updates.
            if (
                typeof delta === 'number' &&
                Number.isFinite(delta)
            ) {
                setCartCount((current) =>
                    Math.max(0, current + delta),
                )
                setCartLoading(false)
            }
        }

        window.addEventListener(
            'ruma:cart-updated',
            handleCartUpdated,
        )

        /*
         * Refresh cart count when the browser tab becomes
         * active again.
         */
        const handleVisibilityChange = () => {
            if (
                document.visibilityState ===
                'visible'
            ) {
                void loadCartCount()
            }
        }

        document.addEventListener(
            'visibilitychange',
            handleVisibilityChange,
        )

        return () => {
            window.removeEventListener(
                'ruma:cart-updated',
                handleCartUpdated,
            )

            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            )
        }
    }, [])

    const handleSearchSubmit = (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault()

        const trimmedQuery =
            searchQuery.trim()

        if (!trimmedQuery) {
            router.push('/catalogue')
            return
        }

        router.push(
            `/catalogue?q=${encodeURIComponent(
                trimmedQuery,
            )}`,
        )

        setMobileSearchOpen(false)
    }

    const handleMobileSearch = () => {
        const trimmedQuery =
            searchQuery.trim()

        if (!trimmedQuery) {
            return
        }

        router.push(
            `/catalogue?q=${encodeURIComponent(
                trimmedQuery,
            )}`,
        )

        setMobileSearchOpen(false)
    }

    return (
        <header className="w-full border-b border-line bg-surface">
            {/* =========================
                MAIN HEADER
            ========================== */}
            <div
                className="
                    mx-auto
                    flex
                    h-18
                    w-full
                    max-w-[1600px]
                    items-center
                    gap-4
                    px-5
                    sm:px-8
                    lg:gap-6
                    lg:px-10
                    xl:px-12
                "
            >
                {/* Logo */}
                <Link
                    href="/"
                    className="flex shrink-0 items-center gap-2"
                    aria-label="Ruma home"
                >
                    <span
                        className="
                            flex
                            h-6
                            w-6
                            items-center
                            justify-center
                            rounded-full
                            border
                            border-ink
                        "
                        aria-hidden="true"
                    >
                        <span className="h-2.5 w-2.5 rounded-full bg-ink" />
                    </span>

                    <span
                        className="
                            font-serif
                            text-2xl
                            font-semibold
                            tracking-tight
                            text-ink
                        "
                    >
                        Ruma
                    </span>
                </Link>

                {/* =========================
                    DESKTOP SEARCH
                ========================== */}
                <form
                    onSubmit={handleSearchSubmit}
                    className="
                        hidden
                        min-w-0
                        flex-1
                        lg:block
                    "
                >
                    <div className="mx-auto max-w-xl">
                        <div className="relative">
                            <svg
                                className="
                                    pointer-events-none
                                    absolute
                                    left-4
                                    top-1/2
                                    -translate-y-1/2
                                    text-ink-muted
                                "
                                width="17"
                                height="17"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <circle
                                    cx="11"
                                    cy="11"
                                    r="7"
                                />
                                <path d="m20 20-3.5-3.5" />
                            </svg>

                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(event) =>
                                    setSearchQuery(
                                        event.target.value,
                                    )
                                }
                                placeholder="Search products, brands..."
                                className="
                                    h-12
                                    w-full
                                    rounded-md
                                    border
                                    border-line
                                    bg-white
                                    pl-12
                                    pr-4
                                    text-sm
                                    text-ink
                                    outline-none
                                    placeholder:text-ink-muted
                                    focus:border-brand
                                "
                                aria-label="Search products and brands"
                            />
                        </div>
                    </div>
                </form>

                {/* =========================
                    HEADER ACTIONS
                ========================== */}
                <div
                    className="
                        ml-auto
                        flex
                        shrink-0
                        items-center
                        gap-2
                        sm:gap-4
                        lg:gap-6
                    "
                >
                    {/* Mobile Search Toggle */}
                    <button
                        type="button"
                        onClick={() =>
                            setMobileSearchOpen(
                                (current) => !current,
                            )
                        }
                        className="
                            flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            text-ink-muted
                            lg:hidden
                        "
                        aria-label={
                            mobileSearchOpen
                                ? 'Close search'
                                : 'Search'
                        }
                        aria-expanded={
                            mobileSearchOpen
                        }
                    >
                        {mobileSearchOpen ? (
                            <svg
                                width="21"
                                height="21"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                aria-hidden="true"
                            >
                                <path d="M6 6l12 12" />
                                <path d="M18 6 6 18" />
                            </svg>
                        ) : (
                            <svg
                                width="21"
                                height="21"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <circle
                                    cx="11"
                                    cy="11"
                                    r="7"
                                />
                                <path d="m20 20-3.5-3.5" />
                            </svg>
                        )}
                    </button>

                    {/* Wishlist */}
                    <Link
                        href="/wishlist"
                        className="
                            relative
                            flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            text-ink-muted
                            transition-colors
                            hover:text-ink
                        "
                        aria-label={`Wishlist (${wishlistCount} items)`}
                    >
                        <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.55"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
                        </svg>

                        {wishlistCount > 0 && (
                            <span
                                className="
                                    absolute
                                    -right-1
                                    -top-1
                                    flex
                                    h-4.5
                                    min-w-4.5
                                    items-center
                                    justify-center
                                    rounded-full
                                    bg-brand
                                    px-1
                                    text-[9px]
                                    font-bold
                                    leading-none
                                    text-white
                                "
                            >
                                {wishlistCount > 9
                                    ? '9+'
                                    : wishlistCount}
                            </span>
                        )}
                    </Link>

                    {/* =========================
                        SHOPPING CART
                    ========================== */}
                    <Link
                        href="/cart"
                        className="
                            relative
                            flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            text-ink-muted
                            transition-colors
                            hover:text-ink
                        "
                        aria-label={`Shopping cart (${cartCount} items)`}
                    >
                        {/* Shopping bag / cart icon */}
                        <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.55"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M6 8.5V7a6 6 0 0 1 12 0v1.5" />
                            <path d="M5 8.5h14l1 12.5H4L5 8.5Z" />
                            <path d="M9 11.5a3 3 0 0 0 6 0" />
                        </svg>

                        {/* Quantity bubble */}
                        {!cartLoading &&
                            cartCount > 0 && (
                                <span
                                    className="
                                        absolute
                                        -right-1
                                        -top-1
                                        flex
                                        h-4.5
                                        min-w-4.5
                                        items-center
                                        justify-center
                                        rounded-full
                                        bg-brand
                                        px-1
                                        text-[9px]
                                        font-bold
                                        leading-none
                                        text-white
                                    "
                                >
                                    {cartCount > 9
                                        ? '9+'
                                        : cartCount}
                                </span>
                            )}
                    </Link>

                    {/* Account */}
                    <Link
                        href="/account"
                        className="
                            flex
                            items-center
                            gap-2
                            text-sm
                            text-ink-muted
                            hover:text-ink
                        "
                        aria-label="Account"
                    >
                        <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.55"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle
                                cx="12"
                                cy="8"
                                r="4"
                            />
                            <path d="M4 21c0-4.42 3.58-8 8-8s8 3.58 8 8" />
                        </svg>

                        <span className="hidden lg:inline text-ink">
                            Account
                        </span>
                    </Link>
                </div>
            </div>

            {/* =========================
                MOBILE SEARCH
            ========================== */}
            {mobileSearchOpen && (
                <form
                    onSubmit={handleSearchSubmit}
                    className="
                        border-t
                        border-line
                        bg-surface
                        px-5
                        py-3
                        lg:hidden
                    "
                >
                    <div className="relative flex items-center">
                        <svg
                            className="
                                pointer-events-none
                                absolute
                                left-3.5
                                text-ink-muted
                            "
                            width="17"
                            height="17"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle
                                cx="11"
                                cy="11"
                                r="7"
                            />
                            <path d="m20 20-3.5-3.5" />
                        </svg>

                        <input
                            autoFocus
                            type="search"
                            value={searchQuery}
                            onChange={(event) =>
                                setSearchQuery(
                                    event.target.value,
                                )
                            }
                            placeholder="Search products, brands..."
                            enterKeyHint="search"
                            className="
                                h-11
                                w-full
                                rounded-md
                                border
                                border-line
                                bg-white
                                pl-10
                                pr-12
                                text-sm
                                text-ink
                                outline-none
                                placeholder:text-ink-muted
                                focus:border-brand
                            "
                            aria-label="Search products and brands"
                        />

                        {/* Mobile Search Button */}
                        <button
                            type="button"
                            onClick={
                                handleMobileSearch
                            }
                            disabled={
                                !searchQuery.trim()
                            }
                            className="
                                absolute
                                right-1.5
                                flex
                                h-8
                                w-8
                                items-center
                                justify-center
                                rounded-md
                                text-brand
                                transition-colors
                                disabled:cursor-not-allowed
                                disabled:opacity-30
                            "
                            aria-label="Search"
                        >
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <circle
                                    cx="11"
                                    cy="11"
                                    r="7"
                                />
                                <path d="m20 20-3.5-3.5" />
                            </svg>
                        </button>
                    </div>
                </form>
            )}
        </header>
    )
}