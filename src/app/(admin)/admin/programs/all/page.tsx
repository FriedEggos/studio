
'use client';

import { Button, buttonVariants } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Trash2, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, writeBatch, getDocs, doc, Timestamp } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';

type Program = {
    id: string;
    title: string;
    startDateTime: Timestamp;
    endDateTime: Timestamp;
    status: 'upcoming' | 'ongoing' | 'completed';
    qrSlug: string;
};

export default function AllProgramsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null);
  const [now, setNow] = useState(new Date());

  const programsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // Sort by status descending (U > O > C), then by start date ascending (nearest first)
    return query(collection(firestore, 'programs'), orderBy('status', 'desc'), orderBy('startDateTime', 'asc'));
  }, [firestore, user]);
  
  const { data: programs, isLoading: isLoadingPrograms } = useCollection<Program>(programsQuery);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const handleDeleteProgram = async () => {
    if (!firestore || !programToDelete) return;
    setIsDeleting(true);

    try {
      const batch = writeBatch(firestore);
      const attendancesColRef = collection(firestore, 'programs', programToDelete.id, 'attendances');
      const attendancesSnapshot = await getDocs(attendancesColRef);
      attendancesSnapshot.forEach((doc) => batch.delete(doc.ref));

      const configDocRef = doc(firestore, 'programConfigs', programToDelete.id);
      batch.delete(configDocRef);

      if (programToDelete.qrSlug) {
        const slugDocRef = doc(firestore, 'qrSlugs', programToDelete.qrSlug);
        batch.delete(slugDocRef);
      }
      
      const programDocRef = doc(firestore, 'programs', programToDelete.id);
      batch.delete(programDocRef);

      await batch.commit();
      toast({
        title: "Program Deleted",
        description: `"${programToDelete.title}" and all its data have been removed.`,
      });

    } catch (error) {
      console.error("Error deleting program:", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: "An error occurred while deleting the program.",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setProgramToDelete(null);
    }
  };

  const getProgramStatus = (program: Program): 'upcoming' | 'ongoing' | 'completed' => {
      const startTime = program.startDateTime?.toDate();
      const endTime = program.endDateTime?.toDate();
      if (!startTime || !endTime) return 'upcoming';
      if (now < startTime) return 'upcoming';
      if (now > endTime) return 'completed';
      return 'ongoing';
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/admin/dashboard">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                All Programs
            </h1>
        </div>
          <Card>
              <CardHeader>
                <CardTitle className="font-headline">Full Program History</CardTitle>
                <CardDescription>
                  Browse and manage all programs ever created.
                </CardDescription>
              </CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader>
                          <TableRow>
                          <TableHead>Program</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead><span className="sr-only">Actions</span></TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {isLoadingPrograms ? (
                          [...Array(10)].map((_, i) => (
                              <TableRow key={i}>
                              <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                              <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                              <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                              </TableRow>
                          ))
                          ) : programs && programs.length > 0 ? (
                          programs.map((program) => {
                            const dynamicStatus = getProgramStatus(program);
                            return (
                              <TableRow key={program.id}>
                                  <TableCell>
                                  <div className="font-medium">{program.title}</div>
                                  <div className="text-sm text-muted-foreground hidden md:inline">
                                      {program.startDateTime ? format(program.startDateTime.toDate(), "d MMM yyyy @ HH:mm") : 'Invalid Date'}
                                  </div>
                                  </TableCell>
                                  <TableCell>
                                  <Badge variant={dynamicStatus === 'completed' ? 'outline' : dynamicStatus === 'ongoing' ? 'default' : 'secondary'} className="capitalize">{dynamicStatus}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                      <Button size="icon" variant="ghost">
                                          <MoreHorizontal className="h-4 w-4" />
                                          <span className="sr-only">Actions for {program.title}</span>
                                      </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                      <DropdownMenuItem asChild>
                                          <Link href={`/p/${program.qrSlug}`} target="_blank">View QR Form</Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                          <Link href={`/admin/programs/${program.id}`}>View Details</Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                          <Link href={`/admin/programs/${program.id}/edit`}>Edit Program</Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                          onSelect={(e) => {
                                            e.preventDefault();
                                            setProgramToDelete(program);
                                            setIsDeleteDialogOpen(true);
                                          }}
                                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                        >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Program
                                      </DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                                  </TableCell>
                              </TableRow>
                            )
                          })
                          ) : (
                          <TableRow>
                              <TableCell colSpan={3} className="h-24 text-center">
                              No programs found.
                              </TableCell>
                          </TableRow>
                          )}
                      </TableBody>
                  </Table>
              </CardContent>
            </Card>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Program</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the program "{programToDelete?.title}"? This will permanently delete the program, its QR code link, its configuration, and all associated attendance records.
              <br/><br/>
              <strong className="text-destructive">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProgramToDelete(null)} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={handleDeleteProgram}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
