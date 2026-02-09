'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth, useUser } from "@/firebase";
import { signOut } from "firebase/auth";
import { Skeleton } from "./ui/skeleton";

export function UserNav({ isAdmin = false }: { isAdmin?: boolean }) {
    const { user, isUserLoading } = useUser();
    const auth = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/');
    };

    if (isUserLoading) {
        return <Skeleton className="h-9 w-9 rounded-full" />;
    }

    if (!user) {
        return (
            <Button asChild>
                <Link href="/login">Log In</Link>
            </Button>
        )
    }

    const profileLink = isAdmin ? "/admin/profile" : "/profile";
    const displayName = isAdmin ? "JTMK Administrator" : "JTMK Student";
    const fallback = user.email?.[0].toUpperCase() ?? (isAdmin ? 'A' : 'S');

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                        <AvatarImage
                            src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`}
                            alt={user.email || ''}
                        />
                        <AvatarFallback>{fallback}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href={profileLink} className="flex items-center w-full cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log Out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
