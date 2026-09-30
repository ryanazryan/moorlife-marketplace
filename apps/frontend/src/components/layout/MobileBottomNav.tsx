'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
    label: string
    href: string
    icon: React.ReactNode
}

const navItems: NavItem[] = [
    {
        label: 'Home',
        href: '/',
        icon: (
            <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="m3.5 10 8.5-7 8.5 7" />
                <path d="M5.5 9.5V21h13V9.5" />
                <path d="M9.5 21v-6h5v6" />
            </svg>
        ),
    },
    {
        label: 'Browse',
        href: '/catalogue',
        icon: (
            <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
            >
                <line x1="5" y1="7" x2="19" y2="7" />
                <line x1="5" y1="12" x2="19" y2="12" />
                <line x1="5" y1="17" x2="19" y2="17" />
            </svg>
        ),
    },
    {
        label: 'Brands',
        href: '/brands',
        icon: (
            <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z" />
                <path d="m5 7 7 4 7-4" />
                <path d="M12 11v10" />
            </svg>
        ),
    },
    {
        label: 'Account',
        href: '/account',
        icon: (
            <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <circle cx="12" cy="8" r="3.5" />
                <path d="M4.5 21c.4-4.2 3.4-7 7.5-7s7.1 2.8 7.5 7" />
            </svg>
        ),
    },
]

export function MobileBottomNav() {
    const pathname = usePathname()

    const isActive = (href: string) => {
        if (href === '/') {
            return pathname === '/'
        }

        return (
            pathname === href ||
            pathname.startsWith(`${href}/`)
        )
    }

    return (
        <div
            className="
        fixed
        inset-x-0
        bottom-0
        z-9999
        lg:hidden
        pointer-events-none
    "
            style={{
                paddingBottom: 'env(safe-area-inset-bottom)',
                transform: 'translateZ(0)',
                WebkitTransform: 'translateZ(0)',
            }}
        >
            <nav
                aria-label="Mobile navigation"
                className="
                    pointer-events-auto
                    w-full
                    border-t
                    border-line
                    bg-surface
                "
            >
                <div className="mx-auto grid h-16 w-full max-w-md grid-cols-4">
                    {navItems.map((item) => {
                        const active = isActive(item.href)

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={
                                    active
                                        ? 'page'
                                        : undefined
                                }
                                className={[
                                    'flex min-w-0 flex-col items-center justify-center gap-1',
                                    active
                                        ? 'text-brand'
                                        : 'text-ink-muted',
                                ].join(' ')}
                            >
                                <span className="flex h-6 items-center justify-center">
                                    {item.icon}
                                </span>

                                <span
                                    className={[
                                        'text-[11px] leading-none',
                                        active
                                            ? 'font-medium'
                                            : 'font-normal',
                                    ].join(' ')}
                                >
                                    {item.label}
                                </span>
                            </Link>
                        )
                    })}
                </div>
            </nav>
        </div>
    )
}