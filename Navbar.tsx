import Link from "next/link";
import { useRouter } from "next/router";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import clsx from "clsx";

const links = [
  { href: "/", label: "Overview" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/docs", label: "Docs" },
];

export default function Navbar() {
  const { pathname } = useRouter();

  return (
    <nav className="border-b border-gork-border bg-gork-surface/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-gork-accent font-semibold text-sm tracking-widest">
            GORKWHEEL
          </Link>
          <div className="flex items-center gap-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  pathname === href
                    ? "text-gork-accent bg-gork-accent/10"
                    : "text-gork-text-dim hover:text-gork-text"
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <WalletMultiButton />
      </div>
    </nav>
  );
}
