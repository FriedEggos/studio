
'use client';

import Link from "next/link";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collectionGroup, query, where } from "firebase/firestore";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VerificationNavLinkProps {
  className?: string;
  iconClassName?: string;
}

export function VerificationNavLink({ className, iconClassName }: VerificationNavLinkProps) {
  const firestore = useFirestore();

  const pendingQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collectionGroup(firestore, 'positions'),
      where('verificationStatus', '==', 'pending')
    );
  }, [firestore]);

  const { data: pendingVerifications } = useCollection(pendingQuery);
  const pendingCount = pendingVerifications?.length || 0;

  return (
    <Link
      href="/admin/verifications"
      className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary", className)}
    >
      <ShieldCheck className={cn("h-4 w-4", iconClassName)} />
      <span className="flex-1">Verifications</span>
      {pendingCount > 0 && (
        <Badge className="h-6 w-6 shrink-0 items-center justify-center rounded-full p-0">
          {pendingCount}
        </Badge>
      )}
    </Link>
  );
}
