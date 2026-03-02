
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { List, MoreHorizontal, Trash2, Loader2, Award, Clock, UserPlus, Users, Trophy } from "lucide-react";
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
import { collection, query, orderBy, writeBatch, getDocs, doc, Timestamp, collectionGroup, where, limit } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

type Program = {
    id: string;
    title: string;
    startDateTime: Timestamp;
    endDateTime: Timestamp;
    status: 'upcoming' | 'ongoing' | 'completed';
    qrSlug: string;
};

export default function AdminDashboard() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null);

  const programsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'programs'), orderBy('createdAt', 'desc'));
  }, [firestore, user]);
  
  const { data: programs, isLoading: isLoadingPrograms } = useCollection<Program>(programsQuery);

  const [stats, setStats] = useState({
    monthlyActive: 0,
    avgDuration: 0,
    newStudents: 0,
    legendCount: 0,
    rookieCount: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);

  useEffect(() => {
    if (!firestore) return;

    const fetchStats = async () => {
        setIsLoadingStats(true);
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);

            // Use Promise.all to fetch attendances and users in parallel
            const [attendancesSnapshot, usersSnapshot] = await Promise.all([
                getDocs(collectionGroup(firestore, 'attendances')),
                getDocs(query(collection(firestore, 'users'), where('role', '==', 'student')))
            ]);

            // Calculate stats from snapshots
            const activeEmails = new Set<string>();
            let totalMinutes = 0;
            let okCheckouts = 0;

            attendancesSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.createdAt && (data.createdAt as Timestamp).toDate() >= thirtyDaysAgo) {
                    activeEmails.add(data.email);
                }
                if (data.checkOutStatus === 'ok' && typeof data.durationMinutes === 'number') {
                    totalMinutes += data.durationMinutes;
                    okCheckouts++;
                }
            });

            let newStudents = 0;
            let legendCount = 0;
            let rookieCount = 0;

            usersSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.createdAt && (data.createdAt as Timestamp).toDate() >= thirtyDaysAgo) {
                    newStudents++;
                }
                if (data.badge === 'Legend') legendCount++;
                if (data.badge === 'Rookie') rookieCount++;
            });

            const avgDuration = okCheckouts > 0 ? Math.round(totalMinutes / okCheckouts) : 0;

            setStats({
                monthlyActive: activeEmails.size,
                avgDuration,
                newStudents,
                legendCount,
                rookieCount,
            });

        } catch (error) {
            console.error("Error fetching dashboard stats:", error);
            toast({
                variant: "destructive",
                title: "Failed to load stats",
                description: "Could not load dashboard statistics."
            });
        } finally {
            setIsLoadingStats(false);
        }
    };

    const fetchLeaderboard = async () => {
        setIsLoadingLeaderboard(true);
        try {
            const q = query(
                collection(firestore, 'users'), 
                where('role', '==', 'student'), 
                where('rank', '>', 0), // Only get ranked users
                orderBy('rank', 'asc'), 
                limit(10)
            );
            const querySnapshot = await getDocs(q);
            const topUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLeaderboard(topUsers);
        } catch (error) {
            console.error("Error fetching leaderboard:", error);
            // Non-critical, so maybe a silent fail is okay. Or a subtle toast.
        } finally {
            setIsLoadingLeaderboard(false);
        }
    };

    fetchStats();
    fetchLeaderboard();
  }, [firestore, toast]);


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


  const StatCard = ({ title, icon: Icon, value, isLoading, description }: { title: string, icon: React.ElementType, value: React.ReactNode, isLoading: boolean, description: string }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Programs"
            icon={List}
            value={programs?.length ?? 0}
            isLoading={isLoadingPrograms}
            description="Total programs created."
          />
          <StatCard
            title="Monthly Active Students"
            icon={Users}
            value={stats.monthlyActive}
            isLoading={isLoadingStats}
            description="Unique students in the last 30 days."
          />
          <StatCard
            title="New Student Growth"
            icon={UserPlus}
            value={stats.newStudents}
            isLoading={isLoadingStats}
            description="New students in the last 30 days."
          />
          <StatCard
            title="Badge Distribution"
            icon={Award}
            value={
              <>
                {stats.legendCount}{' '}
                <span className="text-base font-medium text-muted-foreground">vs</span>{' '}
                {stats.rookieCount}
              </>
            }
            isLoading={isLoadingStats}
            description="Legend vs. Rookie badge holders."
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
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
                                      {program.startDateTime ? format(program.startDateTime.toDate(), "d MMM yyyy @ HH:mm") : 'Invalid Date'}
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
            
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" /> Leaderboard</CardTitle>
                    <CardDescription>Top 10 most engaged students.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingLeaderboard ? (
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    ) : leaderboard.length > 0 ? (
                        <ul className="space-y-4">
                            {leaderboard.map((student, index) => (
                                <li key={student.id} className="flex items-center gap-4">
                                    <span className={cn(
                                        "font-bold text-lg w-6 text-center",
                                        index < 3 ? "text-yellow-500" : "text-muted-foreground"
                                    )}>{student.rank}</span>
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={student.photoURL} />
                                        <AvatarFallback>{student.displayName?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-medium truncate">{student.displayName}</p>
                                        <p className="text-xs text-muted-foreground">{student.totalScore} pts</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-sm text-muted-foreground">No ranked students yet.</p>
                             <p className="text-xs text-muted-foreground mt-1">Ranking is updated automatically.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
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
