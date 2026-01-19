import Link from "next/link";
import { QrCode } from "lucide-react";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-foreground transition-colors hover:text-primary"
    >
      <QrCode className="h-7 w-7 text-primary" />
      <span className="text-xl font-bold tracking-tighter font-headline">
        JTMK+
      </span>
    </Link>
  );
}
