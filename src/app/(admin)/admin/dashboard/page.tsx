
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
import { List, MoreHorizontal, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
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
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, writeBatch, getDocs, doc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from 'date-fns';

type Program = {
    id: string;
    title: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    status: 'upcoming' | 'ongoing' | 'completed';
    qrSlug: string;
};

export default function AdminDashboard() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null);

  const programsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'programs'), orderBy('createdAt', 'desc'));
  }, [firestore]);
  
  const { data: programs, isLoading: isLoadingPrograms } = useCollection<Program>(programsQuery);

  const handleDeleteProgram = async () => {
    if (!firestore || !programToDelete) return;
    setIsDeleting(true);

    try {
      const batch = writeBatch(firestore);

      // Delete attendances subcollection
      const attendancesColRef = collection(firestore, 'programs', programToDelete.id, 'attendances');
      const attendancesSnapshot = await getDocs(attendancesColRef);
      attendancesSnapshot.forEach((doc) => batch.delete(doc.ref));

      // Delete program config
      const configDocRef = doc(firestore, 'programConfigs', programToDelete.id);
      batch.delete(configDocRef);

      // Delete QR slug mapping
      if (programToDelete.qrSlug) {
        const slugDocRef = doc(firestore, 'qrSlugs', programToDelete.qrSlug);
        batch.delete(slugDocRef);
      }
      
      // Delete the main program document
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


  const StatCard = ({ title, icon: Icon, value, isLoading, description }: { title: string, icon: React.ElementType, value: number, isLoading: boolean, description: string }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
            Admin Dashboard
          </h1>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/admin/programs/create">Create New Program</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <StatCard
            title="Total Programs"
            icon={List}
            value={programs?.length ?? 0}
            isLoading={isLoadingPrograms}
            description="Total programs created."
          />
        </div>

        <Card>
            <CardHeader>
              <CardTitle className="font-headline">Program List</CardTitle>
              <CardDescription>
                A summary of all created programs.
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
                        [...Array(5)].map((_, i) => (
                            <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                            </TableRow>
                        ))
                        ) : programs && programs.length > 0 ? (
                        programs.map((program) => (
                            <TableRow key={program.id}>
                                <TableCell>
                                <div className="font-medium">{program.title}</div>
                                <div className="text-sm text-muted-foreground hidden md:inline">
                                    {format(parseISO(program.startDate), "d MMM yyyy")} @ {program.startTime}
                                </div>
                                </TableCell>
                                <TableCell>
                                <Badge variant={program.status === 'completed' ? 'outline' : program.status === 'ongoing' ? 'default' : 'secondary'} className="capitalize">{program.status}</Badge>
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
                        ))
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
