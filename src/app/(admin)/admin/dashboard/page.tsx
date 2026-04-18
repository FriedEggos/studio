
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
import { List, MoreHorizontal, Trash2, Loader2, UserPlus, Users, Download, ArrowRight } from "lucide-react";
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
import { collection, query, orderBy, writeBatch, getDocs, doc, Timestamp, collectionGroup, where, limit, deleteDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { Input } from "@/components/ui/input";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


type Program = {
    id: string;
    title: string;
    startDateTime: Timestamp;
    endDateTime: Timestamp;
    status: 'upcoming' | 'ongoing' | 'completed';
    qrSlug: string;
};

type Position = {
  id: string;
  userId: string;
  userName: string;
  matricId: string;
  course: string;
  positionName: string;
  customPositionDetail?: string;
  programName: string;
  peringkat: string;
  semester: number;
  className: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  createdAt: { toDate: () => Date };
};


export default function AdminDashboard() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null);
  
  const [positionToDelete, setPositionToDelete] = useState<Position | null>(null);
  const [isDeletePositionDialogOpen, setIsDeletePositionDialogOpen] = useState(false);
  const [isDeletingPosition, setIsDeletingPosition] = useState(false);

  const [now, setNow] = useState(new Date());

  const programsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'programs'), orderBy('createdAt', 'desc'), limit(5));
  }, [firestore, user]);
  
  const { data: programs, isLoading: isLoadingPrograms } = useCollection<Program>(programsQuery);

  const [stats, setStats] = useState({
    totalPrograms: 0,
    monthlyActive: 0,
    newStudents: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // New state for contribution history
  const [searchQuery, setSearchQuery] = useState("");

  const approvedPositionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collectionGroup(firestore, 'positions'),
      where('verificationStatus', '==', 'approved'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore]);

  const { data: approvedPositions, isLoading: isLoadingApproved } = useCollection<Position>(approvedPositionsQuery);

  const filteredPositions = useMemo(() => {
    if (!approvedPositions) return [];
    if (!searchQuery) return approvedPositions;
    return approvedPositions.filter(pos =>
      pos.matricId?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [approvedPositions, searchQuery]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!firestore) return;

    const fetchStats = async () => {
        setIsLoadingStats(true);
        try {
            // Get start of current month for active students
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfMonthTimestamp = Timestamp.fromDate(startOfMonth);

            // Get start of last 30 days for new student growth
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);

            // Define queries
            const programsQuery = collection(firestore, 'programs');
            
            const activeStudentsQuery = query(
              collectionGroup(firestore, 'attendances'), 
              where('createdAt', '>=', startOfMonthTimestamp)
            );

            const newStudentsQuery = query(
              collection(firestore, 'users'), 
              where('role', '==', 'student'), 
              where('createdAt', '>=', thirtyDaysAgoTimestamp)
            );

            // Fetch data in parallel
            const [programsSnapshot, activeStudentsSnapshot, newStudentsSnapshot] = await Promise.all([
                getDocs(programsQuery),
                getDocs(activeStudentsQuery),
                getDocs(newStudentsQuery)
            ]);
            
            // Calculate Total Programs
            const totalPrograms = programsSnapshot.size;

            // Calculate Monthly Active Students from attendances
            const activeEmails = new Set<string>();
            activeStudentsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.email) {
                    activeEmails.add(data.email);
                }
            });
            const monthlyActive = activeEmails.size;

            // Calculate New Student Growth
            const newStudents = newStudentsSnapshot.size;

            setStats({
                totalPrograms,
                monthlyActive,
                newStudents,
            });

        } catch (error) {
            console.error("Error fetching dashboard stats:", error);
            toast({
                variant: "destructive",
                title: "Failed to load stats",
                description: "Could not load dashboard statistics. You may need to create a Firestore index."
            });
        } finally {
            setIsLoadingStats(false);
        }
    };

    fetchStats();
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

  const handleDeletePosition = async () => {
    if (!firestore || !positionToDelete) return;
    setIsDeletingPosition(true);

    try {
        const positionDocRef = doc(firestore, 'users', positionToDelete.userId, 'positions', positionToDelete.id);
        await deleteDoc(positionDocRef);

        toast({
            title: "Contribution Deleted",
            description: "The contribution record has been successfully removed.",
        });
    } catch (error) {
        console.error("Error deleting contribution:", error);
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: "An error occurred while deleting the contribution.",
        });
    } finally {
        setIsDeletingPosition(false);
        setIsDeletePositionDialogOpen(false);
        setPositionToDelete(null);
    }
  };


  const handleDownloadPdf = () => {
    if (!filteredPositions || filteredPositions.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "There are no records to export.",
      });
      return;
    }

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    const signatureX = 14;

    // PDF Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text('REKOD SUMBANGAN PELAJAR JTMK', doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    
    let startY = 35;
    
    // Conditional logic for PDF content
    if (searchQuery && filteredPositions.length > 0) {
      // ** STUDENT-SPECIFIC REPORT **
      const student = filteredPositions[0];
      doc.text(`Nama Pelajar: ${student.userName}`, 14, startY);
      doc.text(`ID Matrik: ${student.matricId}`, 14, startY + 6);
      startY += 15;
      
      autoTable(doc, {
        startY: startY,
        head: [['No.', 'Program', 'Peringkat', 'Jawatan', 'Semester', 'Class', 'Tarikh']],
        body: filteredPositions.map((p, index) => [
          index + 1,
          p.programName,
          p.peringkat,
          p.positionName === 'AJK Lain-Lain' && p.customPositionDetail
            ? `${p.positionName} (${p.customPositionDetail})`
            : p.positionName,
          p.semester,
          p.className,
          p.createdAt ? format(p.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [37, 51, 89] },
      });

    } else {
      // ** "ALL" REPORT **
      autoTable(doc, {
        startY: startY,
        head: [['No.', 'Student', 'Matric ID', 'Program', 'Level', 'Position', 'Semester', 'Class', 'Date']],
        body: filteredPositions.map((p, index) => [
          index + 1,
          p.userName,
          p.matricId,
          p.programName,
          p.peringkat,
          p.positionName === 'AJK Lain-Lain' && p.customPositionDetail
            ? `${p.positionName} (${p.customPositionDetail})`
            : p.positionName,
          p.semester,
          p.className,
          p.createdAt ? format(p.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [37, 51, 89] },
      });
    }

    // Signature Section
    let finalY = (doc as any).lastAutoTable.finalY || pageHeight - 60;
    let signatureY = finalY + 25;

    if (signatureY > pageHeight - 50) {
        doc.addPage();
        signatureY = 40; // Start at top of new page
    }
    
    doc.setFontSize(10);
    doc.text('_______________________________', signatureX, signatureY);
    doc.text('(PENYELARAS KELAB ICT JTMK)', signatureX, signatureY + 6);
    doc.text('POLITEKNIK KUCHING SARAWAK', signatureX, signatureY + 12);
    doc.text('Nama:', signatureX, signatureY + 22);
    doc.text('Tarikh:', signatureX, signatureY + 28);

    doc.save(`JTMK_Sumbangan_Pelajar_${new Date().toISOString().split('T')[0]}.pdf`);
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

  const getProgramStatus = (program: Program): 'upcoming' | 'ongoing' | 'completed' => {
      const startTime = program.startDateTime?.toDate();
      const endTime = program.endDateTime?.toDate();

      if (!startTime || !endTime) {
          return 'upcoming';
      }

      if (now < startTime) {
          return 'upcoming';
      }
      if (now > endTime) {
          return 'completed';
      }
      return 'ongoing';
  };

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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Total Programs"
            icon={List}
            value={stats.totalPrograms}
            isLoading={isLoadingStats}
            description="Total programs created."
          />
          <StatCard
            title="Monthly Active Students"
            icon={Users}
            value={stats.monthlyActive}
            isLoading={isLoadingStats}
            description="Unique students this month."
          />
          <StatCard
            title="New Student Growth"
            icon={UserPlus}
            value={stats.newStudents}
            isLoading={isLoadingStats}
            description="New students in the last 30 days."
          />
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="font-headline">Recent Programs</CardTitle>
                    <CardDescription>A summary of the 5 most recently created programs.</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                    <Link href="/admin/programs/all">
                        View All
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
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

            <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="font-headline">Student Contribution History</CardTitle>
                  <CardDescription>
                    Search and view all approved student contributions.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Input 
                        placeholder="Search by Matric ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:w-64"
                    />
                    <Button onClick={handleDownloadPdf} variant="outline" size="sm" disabled={!filteredPositions || filteredPositions.length === 0}>
                      <Download className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>No.</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Matric ID</TableHead>
                            <TableHead>Program</TableHead>
                            <TableHead>Level</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Semester</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingApproved ? (
                            [...Array(5)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-6" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-9 w-9" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredPositions && filteredPositions.length > 0 ? (
                            filteredPositions.map((pos, index) => (
                            <TableRow key={pos.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell className="font-medium">{pos.userName}</TableCell>
                                <TableCell>{pos.matricId}</TableCell>
                                <TableCell>{pos.programName}</TableCell>
                                <TableCell>{pos.peringkat}</TableCell>
                                <TableCell>
                                {pos.positionName}
                                {pos.positionName === "AJK Lain-Lain" && pos.customPositionDetail && (
                                    <span className="text-muted-foreground ml-2 text-xs">({pos.customPositionDetail})</span>
                                )}
                                </TableCell>
                                <TableCell>{pos.semester}</TableCell>
                                <TableCell>{pos.className}</TableCell>
                                <TableCell>
                                {pos.createdAt ? format(pos.createdAt.toDate(), 'dd/MM/yyyy') : ''}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => {
                                            setPositionToDelete(pos);
                                            setIsDeletePositionDialogOpen(true);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Delete contribution</span>
                                    </Button>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center">
                                    No approved contributions found for this search.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
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

      <AlertDialog open={isDeletePositionDialogOpen} onOpenChange={setIsDeletePositionDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Contribution Record?</AlertDialogTitle>
                <AlertDialogDescription>
                    Are you sure you want to delete this contribution record for "{positionToDelete?.programName}" by {positionToDelete?.userName}?
                    This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPositionToDelete(null)} disabled={isDeletingPosition}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants({ variant: "destructive" })}
                  onClick={handleDeletePosition}
                  disabled={isDeletingPosition}
                >
                  {isDeletingPosition && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isDeletingPosition ? "Deleting..." : "Delete"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
