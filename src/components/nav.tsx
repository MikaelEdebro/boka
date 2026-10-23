"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string; isActive: (pathname: string) => boolean };

const NAV_LINKS: NavLink[] = [
  {
    href: "/week",
    label: "Vecka",
    isActive: (p) => p.startsWith("/week"),
  },
  {
    href: "/year",
    label: "År",
    isActive: (p) => p.startsWith("/year"),
  },
  {
    href: "/invoices",
    label: "Fakturor",
    isActive: (p) => p.startsWith("/invoices"),
  },
  {
    href: "/settings",
    label: "Inställningar",
    isActive: (p) => p.startsWith("/settings"),
  },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex w-full max-w-3xl items-center gap-4 overflow-x-auto px-6 py-3">
        <Link href="/" className="shrink-0 text-lg font-semibold">
          Boka
        </Link>
        <ul className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = link.isActive(pathname);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
