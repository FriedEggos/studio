
'use client';

import { useCollection, useFirestore, useMemoFirebase, useUser, useFunctions } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  displayName: string;
  email: string;
  role: 'student' | 'admin';
  course?: string;
  photoURL?: string;
}

export default function UsersPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const functions = useFunctions();
  const { toast } = useToast();
  const [isBackfilling, setIsBackfilling] = useState(false);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users'));
  }, [firestore, user]);

  const { data: users, isLoading } = useCollection<User>(usersQuery);

  const handleBackfill = async () => {
    setIsBackfilling(true);
    try {
      const backfillPioneerBadge = httpsCallable(functions, 'backfillPioneerBadge');
      const result: any = await backfillPioneerBadge();
      toast({
        title: 'Backfill Complete',
        description: result.data.message,
      });
    } catch (error: any) {
      console.error("Backfill failed:", error);
      toast({
        variant: 'destructive',
        title: 'Backfill Failed',
        description: error.message,
      });
    } finally {
      setIsBackfilling(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          User Management
        </h1>
        <Button onClick={handleBackfill} disabled={isBackfilling}>
          {isBackfilling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Pioneer Badges
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Browse and manage all registered users in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Course/Department</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : users && users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src={user.photoURL} />
                          <AvatarFallback>{user.displayName?.[0].toUpperCase() || user.email[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{user.displayName}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                    </TableCell>
                    <TableCell>{user.course || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/users/${user.id}`}>
                          <Eye className="mr-2 h-4 w-4" /> View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
