'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import type { ApiBrand } from '@/api/brands'
import {
    getFilteredProducts,
    getProducts,
    getSortedProducts,
    type ApiProduct,
    type ProductCategory,
    type ProductFilterParams,
} from '@/api/products'

import { mapApiProduct } from '@/api/product-mapper'
import type { ProductViewModel } from '@/types/product'

import {
    CatalogueFilters,
    type CatalogueFilterState,
} from './CatalogueFilters'

import {
    CatalogueToolbar,
    type CatalogueSort,
} from './CatalogueToolbar'

import { ProductCard } from './ProductCard'

interface CatalogueClientProps {
    initialProducts: ProductViewModel[]
    categories: ProductCategory[]
    brands: ApiBrand[]
}

function mapProducts(
    products: ApiProduct[],
): ProductViewModel[] {
    return products.map(mapApiProduct)
}

function sortProductsLocally(
    products: ProductViewModel[],
    sort: CatalogueSort,
): ProductViewModel[] {
    if (sort === 'recommended') {
        return products
    }

    const sorted = [...products]

    switch (sort) {
        case 'price-asc':
            sorted.sort(
                (a, b) => a.price - b.price,
            )
            break

        case 'price-desc':
            sorted.sort(
                (a, b) => b.price - a.price,
            )
            break

        case 'newest':
            sorted.sort(
                (a, b) =>
                    new Date(
                        b.createdAt,
                    ).getTime() -
                    new Date(
                        a.createdAt,
                    ).getTime(),
            )
            break

        default:
            break
    }

    return sorted
}

function getSortParams(
    sort: CatalogueSort,
) {
    switch (sort) {
        case 'newest':
            return {
                sortBy: 'newest' as const,
                sortOrder: 'desc' as const,
            }

        case 'price-asc':
            return {
                sortBy: 'price' as const,
                sortOrder: 'asc' as const,
            }

        case 'price-desc':
            return {
                sortBy: 'price' as const,
                sortOrder: 'desc' as const,
            }

        default:
            return null
    }
}

/**
 * Converts internal category UUID into
 * the human-readable category slug used
 * by the browser URL.
 *
 * Example:
 * categoryId = "uuid..."
 * category.slug = "living"
 *
 * Result:
 * /catalogue?category=living
 */
function buildCatalogueUrl(
    filters: CatalogueFilterState,
    sort: CatalogueSort,
    categories: ProductCategory[],
): string {
    const params = new URLSearchParams(
        window.location.search,
    )

    /*
     * Category
     *
     * Internal state/API:
     *   UUID
     *
     * Browser URL:
     *   slug
     */
    if (filters.categoryId) {
        const category = categories.find(
            (item) =>
                item.id === filters.categoryId,
        )

        if (category?.slug) {
            params.set(
                'category',
                category.slug,
            )
        } else {
            params.delete('category')
        }
    } else {
        params.delete('category')
    }

    /*
     * Brand
     *
     * Keep UUID because backend filter
     * expects brandId.
     */
    if (filters.brandId) {
        params.set(
            'brandId',
            filters.brandId,
        )
    } else {
        params.delete('brandId')
    }

    /*
     * Minimum price
     */
    if (
        filters.minPrice !== undefined
    ) {
        params.set(
            'minPrice',
            String(filters.minPrice),
        )
    } else {
        params.delete('minPrice')
    }

    /*
     * Maximum price
     */
    if (
        filters.maxPrice !== undefined
    ) {
        params.set(
            'maxPrice',
            String(filters.maxPrice),
        )
    } else {
        params.delete('maxPrice')
    }

    /*
     * Sort
     */
    if (sort !== 'recommended') {
        params.set('sort', sort)
    } else {
        params.delete('sort')
    }

    const queryString =
        params.toString()

    return queryString
        ? `/catalogue?${queryString}`
        : '/catalogue'
}

function getActivePriceLabel(
    filters: CatalogueFilterState,
) {
    if (
        filters.minPrice === undefined &&
        filters.maxPrice === undefined
    ) {
        return null
    }

    if (
        filters.minPrice === undefined &&
        filters.maxPrice === 100000
    ) {
        return 'Under Rp100.000'
    }

    if (
        filters.minPrice === 100000 &&
        filters.maxPrice === 200000
    ) {
        return 'Rp100.000 – Rp200.000'
    }

    if (
        filters.minPrice === 200000 &&
        filters.maxPrice === undefined
    ) {
        return 'Over Rp200.000'
    }

    if (
        filters.minPrice !== undefined &&
        filters.maxPrice !== undefined
    ) {
        return `Rp${filters.minPrice.toLocaleString(
            'id-ID',
        )} – Rp${filters.maxPrice.toLocaleString(
            'id-ID',
        )}`
    }

    if (
        filters.minPrice !== undefined
    ) {
        return `From Rp${filters.minPrice.toLocaleString(
            'id-ID',
        )}`
    }

    if (
        filters.maxPrice !== undefined
    ) {
        return `Up to Rp${filters.maxPrice.toLocaleString(
            'id-ID',
        )}`
    }

    return 'Price'
}

export function CatalogueClient({
    initialProducts,
    categories,
    brands,
}: CatalogueClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const handleProductClick = (slug: string) => {
        router.push(`/product/${slug}`)
    }

    const [products, setProducts] =
        useState<ProductViewModel[]>(
            initialProducts,
        )

    const [filters, setFilters] =
        useState<CatalogueFilterState>(
            {},
        )

    const [sort, setSort] =
        useState<CatalogueSort>(
            'recommended',
        )

    const [view, setView] =
        useState<'grid' | 'list'>(
            'grid',
        )

    const [loading, setLoading] =
        useState(false)

    const [error, setError] =
        useState<string | null>(null)

    const [
        mobileFilterOpen,
        setMobileFilterOpen,
    ] = useState(false)

    /*
     * Prevent stale client responses
     * from overwriting newer state.
     */
    const requestIdRef =
        useRef(0)

    /*
     * ============================================================
     * URL PARAMETERS
     * ============================================================
     */

    const categoryParam =
        searchParams
            .get('category')
            ?.trim()
            .toLowerCase() ?? ''

    const brandParam =
        searchParams
            .get('brandId')
            ?.trim() ?? ''

    const minPriceParam =
        searchParams.get('minPrice')

    const maxPriceParam =
        searchParams.get('maxPrice')

    const sortParam =
        searchParams
            .get('sort')
            ?.trim()
            .toLowerCase() ?? ''

    /*
     * ============================================================
     * URL → INTERNAL FILTER STATE
     * ============================================================
     *
     * URL:
     * /catalogue?category=living
     *
     * becomes:
     * filters.categoryId = UUID
     *
     * This makes CatalogueFilters recognize
     * the correct category checkbox.
     */
    useEffect(() => {
        const selectedCategory =
            categoryParam
                ? categories.find(
                    (category) =>
                        category.slug
                            ?.trim()
                            .toLowerCase() ===
                        categoryParam ||
                        category.id ===
                        categoryParam,
                )
                : undefined

        const parsedMinPrice =
            minPriceParam !== null &&
                minPriceParam !== ''
                ? Number(minPriceParam)
                : undefined

        const parsedMaxPrice =
            maxPriceParam !== null &&
                maxPriceParam !== ''
                ? Number(maxPriceParam)
                : undefined

        /*
         * Server page is the source of truth
         * for initial products.
         */
        setProducts(initialProducts)

        setFilters({
            ...(selectedCategory
                ? {
                    categoryId:
                        selectedCategory.id,
                }
                : {}),
            ...(brandParam
                ? {
                    brandId:
                        brandParam,
                }
                : {}),
            ...(parsedMinPrice !==
                undefined &&
                !Number.isNaN(
                    parsedMinPrice,
                )
                ? {
                    minPrice:
                        parsedMinPrice,
                }
                : {}),
            ...(parsedMaxPrice !==
                undefined &&
                !Number.isNaN(
                    parsedMaxPrice,
                )
                ? {
                    maxPrice:
                        parsedMaxPrice,
                }
                : {}),
        })

        setSort(
            sortParam === 'newest' ||
                sortParam === 'price-asc' ||
                sortParam === 'price-desc'
                ? sortParam
                : 'recommended',
        )
    }, [
        initialProducts,
        categories,
        categoryParam,
        brandParam,
        minPriceParam,
        maxPriceParam,
        sortParam,
    ])

    /*
     * ============================================================
     * MOBILE BODY SCROLL LOCK
     * ============================================================
     */

    useEffect(() => {
        if (!mobileFilterOpen) {
            document.body.style.overflow =
                ''
            return
        }

        document.body.style.overflow =
            'hidden'

        return () => {
            document.body.style.overflow =
                ''
        }
    }, [mobileFilterOpen])

    /*
     * ============================================================
     * ACTIVE FILTERS
     * ============================================================
     */

    const hasActiveFilters =
        useMemo(() => {
            return Boolean(
                filters.categoryId ||
                filters.brandId ||
                filters.minPrice !==
                undefined ||
                filters.maxPrice !==
                undefined,
            )
        }, [filters])

    const activeFilterLabels =
        useMemo(() => {
            const labels: Array<{
                key: keyof CatalogueFilterState
                label: string
            }> = []

            if (filters.categoryId) {
                const category =
                    categories.find(
                        (item) =>
                            item.id ===
                            filters.categoryId,
                    )

                labels.push({
                    key: 'categoryId',
                    label:
                        category?.name ??
                        'Category',
                })
            }

            if (filters.brandId) {
                const brand =
                    brands.find(
                        (item) =>
                            item.id ===
                            filters.brandId,
                    )

                labels.push({
                    key: 'brandId',
                    label:
                        brand?.name ??
                        'Brand',
                })
            }

            if (
                filters.minPrice !==
                undefined ||
                filters.maxPrice !==
                undefined
            ) {
                labels.push({
                    key: 'minPrice',
                    label:
                        getActivePriceLabel(
                            filters,
                        ) ?? 'Price',
                })
            }

            return labels
        }, [
            filters,
            categories,
            brands,
        ])

    const activeFilterCount =
        activeFilterLabels.length

    /*
     * ============================================================
     * FETCH PRODUCTS
     * ============================================================
     *
     * This is retained for direct client-side
     * filter fetching if needed.
     *
     * However, filter/sort handlers below use
     * router.replace() as the primary source
     * of URL state.
     */
    const fetchProducts = async (
        nextFilters: CatalogueFilterState,
        nextSort: CatalogueSort,
    ) => {
        const requestId =
            ++requestIdRef.current

        setLoading(true)
        setError(null)

        try {
            const hasFilters =
                Boolean(
                    nextFilters.categoryId,
                ) ||
                Boolean(
                    nextFilters.brandId,
                ) ||
                nextFilters.minPrice !==
                undefined ||
                nextFilters.maxPrice !==
                undefined

            let response: ApiProduct[]

            if (!hasFilters) {
                const sortParams =
                    getSortParams(
                        nextSort,
                    )

                if (
                    nextSort ===
                    'recommended' ||
                    !sortParams
                ) {
                    response =
                        await getProducts()
                } else {
                    response =
                        await getSortedProducts(
                            sortParams.sortBy,
                            sortParams.sortOrder,
                        )
                }
            } else {
                const filterParams: ProductFilterParams =
                {
                    categoryId:
                        nextFilters.categoryId,
                    brandId:
                        nextFilters.brandId,
                    minPrice:
                        nextFilters.minPrice,
                    maxPrice:
                        nextFilters.maxPrice,
                }

                response =
                    await getFilteredProducts(
                        filterParams,
                    )
            }

            if (
                requestId !==
                requestIdRef.current
            ) {
                return
            }

            let mappedProducts =
                mapProducts(response)

            if (
                hasFilters &&
                nextSort !==
                'recommended'
            ) {
                mappedProducts =
                    sortProductsLocally(
                        mappedProducts,
                        nextSort,
                    )
            }

            setProducts(
                mappedProducts,
            )
        } catch (err) {
            if (
                requestId !==
                requestIdRef.current
            ) {
                return
            }

            console.error(
                'Failed to load catalogue products:',
                err,
            )

            setError(
                'Failed to load products. Please try again.',
            )
        } finally {
            if (
                requestId ===
                requestIdRef.current
            ) {
                setLoading(false)
            }
        }
    }

    /*
     * ============================================================
     * FILTER CHANGE
     * ============================================================
     *
     * IMPORTANT:
     *
     * Do NOT call fetchProducts() here.
     *
     * router.replace()
     *     ↓
     * server page
     *     ↓
     * API
     *     ↓
     * initialProducts
     *
     * This prevents duplicate requests.
     */
    const handleFilterChange = (
        nextFilters: CatalogueFilterState,
    ) => {
        setFilters(
            nextFilters,
        )

        setError(null)

        /*
         * Changing filter resets sorting.
         */
        const nextSort =
            'recommended'

        setSort(nextSort)

        /*
         * UUID → slug for URL.
         */
        const nextUrl =
            buildCatalogueUrl(
                nextFilters,
                nextSort,
                categories,
            )

        router.replace(
            nextUrl,
            {
                scroll: false,
            },
        )

        if (mobileFilterOpen) {
            setMobileFilterOpen(
                false,
            )
        }
    }

    /*
     * ============================================================
     * SORT CHANGE
     * ============================================================
     */
    const handleSortChange = (
        nextSort: CatalogueSort,
    ) => {
        setSort(nextSort)
        setError(null)

        const nextUrl =
            buildCatalogueUrl(
                filters,
                nextSort,
                categories,
            )

        router.replace(
            nextUrl,
            {
                scroll: false,
            },
        )
    }

    /*
     * ============================================================
     * REMOVE FILTER
     * ============================================================
     */
    const handleRemoveFilter = (
        key: keyof CatalogueFilterState,
    ) => {
        const nextFilters = {
            ...filters,
        }

        if (
            key === 'minPrice' ||
            key === 'maxPrice'
        ) {
            delete nextFilters.minPrice
            delete nextFilters.maxPrice
        } else {
            delete nextFilters[key]
        }

        handleFilterChange(
            nextFilters,
        )
    }

    /*
     * ============================================================
     * CLEAR FILTERS
     * ============================================================
     */
    const handleClearFilters = () => {
        handleFilterChange({})
    }

    /*
     * ============================================================
     * VISIBLE PRODUCTS
     * ============================================================
     */
    const visibleProducts =
        useMemo(() => {
            return sortProductsLocally(
                products,
                sort,
            )
        }, [
            products,
            sort,
        ])

    /*
     * ============================================================
     * RENDER
     * ============================================================
     */
    return (
        <main className="min-h-screen bg-background">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
                {/* Heading */}
                <div className="mb-6 lg:mb-8">
                    <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">
                        Catalogue
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        Discover products from our collection.
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="flex items-start gap-6 lg:gap-8">
                    {/* Desktop / Mobile Filters */}
                    <CatalogueFilters
                        categories={
                            categories
                        }
                        brands={brands}
                        value={filters}
                        onChange={
                            handleFilterChange
                        }
                        mobileOpen={
                            mobileFilterOpen
                        }
                        onMobileClose={() =>
                            setMobileFilterOpen(
                                false,
                            )
                        }
                        resultCount={
                            products.length
                        }
                    />

                    {/* Catalogue */}
                    <section className="min-w-0 flex-1">
                        <CatalogueToolbar
                            productCount={
                                visibleProducts.length
                            }
                            sort={sort}
                            onSortChange={
                                handleSortChange
                            }
                            view={view}
                            onViewChange={
                                setView
                            }
                            onFilterClick={() =>
                                setMobileFilterOpen(
                                    true,
                                )
                            }
                            activeFilterCount={
                                activeFilterCount
                            }
                        />

                        {/* Active filters */}
                        {hasActiveFilters && (
                            <div className="flex flex-wrap items-center gap-2 border-b border-line py-4">
                                <span className="mr-1 text-xs font-medium text-muted-foreground">
                                    Filters:
                                </span>

                                {activeFilterLabels.map(
                                    (
                                        filter,
                                    ) => (
                                        <button
                                            key={`${filter.key}-${filter.label}`}
                                            type="button"
                                            onClick={() =>
                                                handleRemoveFilter(
                                                    filter.key,
                                                )
                                            }
                                            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                                        >
                                            {
                                                filter.label
                                            }

                                            <span
                                                aria-hidden="true"
                                                className="text-muted-foreground"
                                            >
                                                ×
                                            </span>
                                        </button>
                                    ),
                                )}

                                <button
                                    type="button"
                                    onClick={
                                        handleClearFilters
                                    }
                                    className="ml-1 text-xs font-medium text-brand transition-colors hover:underline"
                                >
                                    Clear all
                                </button>
                            </div>
                        )}

                        {/* Loading */}
                        {loading && (
                            <div className="flex items-center justify-center py-16">
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
                                    Loading products...
                                </div>
                            </div>
                        )}

                        {/* Empty */}
                        {!loading &&
                            visibleProducts.length ===
                            0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="mb-4 text-4xl">
                                        ○
                                    </div>

                                    <h2 className="text-lg font-medium text-foreground">
                                        No products found
                                    </h2>

                                    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                                        Try adjusting your filters or clearing them to see more products.
                                    </p>

                                    {hasActiveFilters && (
                                        <button
                                            type="button"
                                            onClick={
                                                handleClearFilters
                                            }
                                            className="mt-5 rounded-md border border-line bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                                        >
                                            Clear filters
                                        </button>
                                    )}
                                </div>
                            )}

                        {/* Products */}
                        {!loading &&
                            visibleProducts.length >
                            0 && (
                                <div
                                    className={
                                        view ===
                                            'grid'
                                            ? 'grid grid-cols-2 gap-x-4 gap-y-8 pt-6 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4'
                                            : 'flex flex-col divide-y divide-line pt-2'
                                    }
                                >
                                    {visibleProducts.map(
                                        (
                                            product,
                                        ) => (
                                            <div
                                                key={
                                                    product.id
                                                }
                                                className={
                                                    view ===
                                                        'list'
                                                        ? 'py-5 first:pt-3'
                                                        : ''
                                                }
                                            >
                                                <ProductCard
                                                    product={
                                                        product
                                                    }
                                                    onProductClick={handleProductClick}
                                                />
                                            </div>
                                        ),
                                    )}
                                </div>
                            )}
                    </section>
                </div>
            </div>
        </main>
    )
}