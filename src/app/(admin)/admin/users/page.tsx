
'use client';

import { useFirestore, useUser } from '@/firebase';
import { collection, query, doc, deleteDoc, getDocs, limit, orderBy, startAfter, where, QueryDocumentSnapshot, Query, DocumentData, onSnapshot } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Eye, Loader2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { getInitials } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface User {
  id: string;
  displayName: string;
  email: string;
  role: 'student' | 'admin';
  course?: string;
  photoURL?: string;
}

const USERS_PER_PAGE = 20;

export default function UsersPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageCursors, setPageCursors] = useState<(QueryDocumentSnapshot | null)[]>([null]);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPage(1);
      setPageCursors([null]);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);


  useEffect(() => {
    if (!firestore) return;
    setIsLoading(true);
    
    let q: Query<DocumentData> = query(collection(firestore, 'users'), orderBy('displayName'));
    
    if (debouncedSearchQuery) {
        const queryUpper = debouncedSearchQuery.toUpperCase();
        q = query(q, 
            where('displayName', '>=', queryUpper),
            where('displayName', '<=', queryUpper + '\uf8ff')
        );
    }

    const cursor = pageCursors[page - 1];
    if (cursor) {
        q = query(q, startAfter(cursor));
    }

    q = query(q, limit(USERS_PER_PAGE + 1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedUsers = snapshot.docs.slice(0, USERS_PER_PAGE).map(doc => ({ id: doc.id, ...doc.data() } as User));
        setUsers(fetchedUsers);
        
        const hasMore = snapshot.docs.length > USERS_PER_PAGE;
        setHasNextPage(hasMore);

        if (hasMore) {
            const lastVisibleDoc = snapshot.docs[USERS_PER_PAGE - 1];
            if (page >= pageCursors.length) {
                 setPageCursors(prev => [...prev, lastVisibleDoc]);
            }
        }
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching users:", error);
        toast({ variant: "destructive", title: "Failed to load users" });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, toast, page, debouncedSearchQuery, pageCursors]);


  const handleNextPage = () => {
      if (hasNextPage) {
          setPage(p => p + 1);
      }
  };

  const handlePrevPage = () => {
      if (page > 1) {
          setPage(p => p - 1);
      }
  };

  const handleDeleteUser = async () => {
    if (!firestore || !userToDelete) return;
    setIsDeleting(true);

    try {
      if (currentUser?.uid === userToDelete.id) {
          toast({
              variant: "destructive",
              title: "Action Not Allowed",
              description: "You cannot delete your own account.",
          });
          return;
      }
      
      const userDocRef = doc(firestore, 'users', userToDelete.id);
      await deleteDoc(userDocRef);
      
      toast({
        title: "User Deleted",
        description: `User "${userToDelete.displayName}" has been removed.`,
      });
      
      // Reset to first page after deletion to ensure data consistency
      setPage(1);
      setPageCursors([null]);

    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: "An error occurred while deleting the user.",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };


  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
            User Management
          </h1>
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>All Users</CardTitle>
                <CardDescription>
                  Browse and manage all registered users in the system.
                </CardDescription>
              </div>
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Course/Department</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right space-x-2"><Skeleton className="h-8 w-20 inline-block" /><Skeleton className="h-8 w-20 inline-block" /></TableCell>
                    </TableRow>
                  ))
                ) : users && users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src={user.photoURL || `https://ui-avatars.com/api/?name=${getInitials(user.displayName || '')}&background=random&color=fff`} />
                            <AvatarFallback>{getInitials(user.displayName || user.email || '')}</AvatarFallback>
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
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/users/${user.id}`}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </Link>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={user.role === 'admin'}
                          onClick={() => {
                            setUserToDelete(user);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
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
          <CardFooter className="flex items-center justify-between border-t pt-6">
            <span className="text-sm text-muted-foreground">
              {`Showing ${users.length} users on page ${page}`}
            </span>
            <div className="flex items-center gap-2">
              <Button onClick={handlePrevPage} disabled={page <= 1 || isLoading} variant="outline" size="sm">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button onClick={handleNextPage} disabled={!hasNextPage || isLoading} variant="outline" size="sm">
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user "{userToDelete?.displayName}"? This will permanently delete their profile data. The user will need to re-register to access the system again.
              <br/><br/>
              <strong className="text-destructive">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={handleDeleteUser}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
