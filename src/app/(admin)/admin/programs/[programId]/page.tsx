
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, deleteDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, MapPin, Link as LinkIcon, Users, Download, Trash2, ChevronDown, FileSpreadsheet, FileText, MoreHorizontal, Clock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/csv-exporter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { QRImageCard } from "@/components/qr-image-card";
import { useState, useEffect, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from "@/lib/utils";
import { manualAdminCheckout } from "@/lib/attendance";


interface Program {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  qrSlug: string;
  redirectUrl?: string;
}

interface Attendance {
    id: string; // This is the student's email
    studentName: string;
    studentId: string;
    classGroup: string;
    createdAt: {
        toDate: () => Date;
    } | null;
    checkOutAt?: {
        toDate: () => Date;
    } | null;
    checkOutStatus?: 'ok' | 'too_early' | 'outside_window' | 'too_short' | 'admin_override';
}

interface User {
  id: string;
  email: string;
  badge?: string;
}


export default function ProgramDetailsPage() {
  const params = useParams();
  const programId = params.programId as string;
  const firestore = useFirestore();
  const { toast } = useToast();
  const [qrFormUrl, setQrFormUrl] = useState('');
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedAttendanceIdForDelete, setSelectedAttendanceIdForDelete] = useState<string | null>(null);
  const [isCheckoutAlertOpen, setIsCheckoutAlertOpen] = useState(false);
  const [selectedAttendanceForCheckout, setSelectedAttendanceForCheckout] = useState<Attendance | null>(null);

  const programDocRef = useMemoFirebase(() => {
    if (!programId || !firestore) return null;
    return doc(firestore, 'programs', programId);
  }, [programId, firestore]);

  const { data: program, isLoading } = useDoc<Program>(programDocRef);
  
  const attendanceQuery = useMemoFirebase(() => {
      if (!programId || !firestore) return null;
      return collection(firestore, 'programs', programId, 'attendances');
  }, [programId, firestore]);
  
  const { data: attendances, isLoading: isLoadingAttendances } = useCollection<Attendance>(attendanceQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: users, isLoading: isLoadingUsers } = useCollection<User>(usersQuery);

  const studentRanks = useMemo(() => {
      if (!users) return new Map<string, string | undefined>();
      return new Map(users.map(user => [user.email, user.badge]));
  }, [users]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        if(program?.qrSlug) {
            setQrFormUrl(`${window.location.origin}/p/${program.qrSlug}`);
        }
    }
  }, [program]);

  const getBadgeColor = (badgeName?: string) => {
    switch (badgeName?.toLowerCase()) {
        case 'legend':
            return 'bg-yellow-400 text-yellow-900 hover:bg-yellow-400/90';
        case 'active':
            return 'bg-blue-500 text-white hover:bg-blue-500/90';
        case 'rookie':
            return 'bg-gray-400 text-gray-900 hover:bg-gray-400/90';
        default:
            return 'bg-secondary text-secondary-foreground';
    }
  };
  
   const handleExport = () => {
    if (!attendances || attendances.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "There is no attendance data to export.",
      });
      return;
    }
    const dataToExport = attendances.map(att => ({
      'Student Name': att.studentName,
      'Student ID': att.studentId,
      'Class': att.classGroup,
      'Check-in Time': att.createdAt ? format(att.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
      'Check-out Time': att.checkOutAt ? format(att.checkOutAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
    }));
    
    exportToCsv(`attendance_${program?.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`, dataToExport);
  };
  
  const handleExportPdf = () => {
    if (!attendances || attendances.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "There is no attendance data to export for PDF.",
      });
      return;
    }
    
    const doc = new jsPDF();
    
    const tableColumns = ["Student Name", "Student ID", "Class", "Check-in Time", "Check-out Time"];
    const tableRows = attendances.map(att => ([
      att.studentName || '',
      att.studentId || '-',
      att.classGroup || '-',
      att.createdAt ? format(att.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
      att.checkOutAt ? format(att.checkOutAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
    ]));

    doc.setFontSize(18);
    doc.text(`Attendances: ${program?.title || 'Program'}`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Date: ${format(new Date(), 'PPP')}`, 14, 30);

    autoTable(doc, {
      startY: 35,
      head: [tableColumns],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [37, 51, 89]
      },
    });

    doc.save(`attendance_${program?.title.replace(/\s+/g, '_') ?? 'export'}.pdf`);
  };

  const handleDeleteAttendance = async (attendanceId: string) => {
    if (!firestore || !programId) return;
    const attendanceDocRef = doc(firestore, 'programs', programId, 'attendances', attendanceId);
    try {
        await deleteDoc(attendanceDocRef);
        toast({
            title: 'Attendance Deleted',
            description: 'The attendance record has been successfully removed.',
        });
    } catch (error) {
        console.error("Error deleting attendance: ", error);
        toast({
            variant: 'destructive',
            title: 'Deletion Failed',
            description: 'Could not remove the attendance record.',
        });
    }
    setIsDeleteAlertOpen(false);
    setSelectedAttendanceIdForDelete(null);
  };

  const handleAdminCheckout = async (attendance: Attendance | null) => {
    if (!firestore || !programId || !attendance) return;
    
    const result = await manualAdminCheckout(firestore, programId, attendance.id);

    if (result.status === 'success') {
      toast({
        title: 'Success!',
        description: result.message,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Override Failed',
        description: result.message,
      });
    }
    
    setIsCheckoutAlertOpen(false);
    setSelectedAttendanceForCheckout(null);
  };

  const getCheckoutTimeClass = (att: Attendance) => {
    if (att.checkOutStatus === 'ok') {
        return 'text-green-600 font-semibold';
    }
    if (
        !att.checkOutAt ||
        att.checkOutStatus === 'too_early' ||
        att.checkOutStatus === 'outside_window' ||
        att.checkOutStatus === 'too_short'
    ) {
        return 'text-red-600 font-semibold';
    }
    return ''; // Default for other statuses like 'admin_override'
  };


  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <Card>
          <CardHeader> <Skeleton className="h-8 w-3/4" /> <Skeleton className="h-5 w-1/2 mt-2" /> </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-6 pt-6">
            <div className="md:col-span-2 space-y-4"> <Skeleton className="h-40 w-full" /> <Skeleton className="h-20 w-full" /> </div>
            <div className="space-y-6"> <Skeleton className="h-40 w-full" /> <Skeleton className="h-24 w-full" /> </div>
          </CardContent>
        </Card>
         <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
      </div>
    );
  }
  
  if (!program) {
      return (
          <div className="text-center py-10">
              <h1 className="text-2xl font-bold">Program Not Found</h1>
              <p className="text-muted-foreground">The program you are looking for does not exist.</p>
              <Button asChild className="mt-4"><Link href="/admin/dashboard">Go to Dashboard</Link></Button>
          </div>
      )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex justify-between items-center">
            <Button variant="outline" asChild>
                <Link href="/admin/dashboard"> <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard </Link>
            </Button>
            <Button asChild>
                <Link href={`/admin/programs/${program.id}/edit`}> Edit Program </Link>
            </Button>
        </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl">{program.title}</CardTitle>
          <CardDescription className="flex items-center gap-4 pt-2">
            <Badge variant={program.status === 'completed' ? 'outline' : program.status === 'ongoing' ? 'default' : 'secondary'} className="capitalize">{program.status}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-8 pt-6">
            <div className="md:col-span-2 space-y-6">
                <div>
                    <h3 className="font-semibold text-lg mb-2">Program Description</h3>
                    <p className="text-muted-foreground">{program.description}</p>
                </div>
            </div>
            <div className="space-y-6">
                 <Card>
                    <CardHeader> <CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" /> Dates & Times</CardTitle> </CardHeader>
                    <CardContent>
                        <p><strong>Start:</strong> {format(parseISO(program.startDate), 'PPP')} at {program.startTime}</p>
                        <p><strong>End:</strong> {format(parseISO(program.endDate), 'PPP')} at {program.endTime}</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader> <CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5" /> Location</CardTitle> </CardHeader>
                    <CardContent> <p>{program.location}</p> </CardContent>
                </Card>
            </div>
        </CardContent>
      </Card>
      
      <div className="max-w-md mx-auto">
        {qrFormUrl ? (
          <QRImageCard 
            qrUrl={qrFormUrl} 
            title="QR Check-in"
            description="Scan this to open the public attendance form."
          />
        ) : (
           <Card>
            <CardHeader>
              <CardTitle className="font-headline">QR Code</CardTitle>
              <CardDescription>Generating QR code...</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 text-center">
              <Skeleton className="h-[224px] w-[224px] rounded-lg" />
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline flex items-center gap-2"><Users className="h-5 w-5" /> Attendances</CardTitle>
              <CardDescription>Total attendees: {isLoadingAttendances ? '...' : attendances?.length ?? 0}</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isLoadingAttendances || !attendances || attendances.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExport}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPdf}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Student Rank</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Check-in Time</TableHead>
                    <TableHead>Check-out Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingAttendances || isLoadingUsers ? (
                     [...Array(3)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : attendances && attendances.length > 0 ? (
                    attendances.map((att) => (
                      <TableRow key={att.id}>
                        <TableCell className="font-medium">{att.studentName}</TableCell>
                        <TableCell>
                          {studentRanks.get(att.id) ? (
                            <Badge variant="outline" className={cn('text-xs', getBadgeColor(studentRanks.get(att.id)))}>
                              {studentRanks.get(att.id)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{att.studentId || '-'}</TableCell>
                        <TableCell>{att.classGroup || '-'}</TableCell>
                        <TableCell>{att.createdAt ? format(att.createdAt.toDate(), 'Pp') : <span className="text-muted-foreground">Syncing...</span>}</TableCell>
                        <TableCell className={cn(getCheckoutTimeClass(att))}>
                            {att.checkOutAt ? format(att.checkOutAt.toDate(), 'Pp') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={!!att.checkOutAt}
                                onClick={() => {
                                  setSelectedAttendanceForCheckout(att);
                                  setIsCheckoutAlertOpen(true);
                                }}
                              >
                                <Clock className="mr-2 h-4 w-4" />
                                <span>Mark as Checked-Out</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => {
                                    setSelectedAttendanceIdForDelete(att.id);
                                    setIsDeleteAlertOpen(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No attendances recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
          </CardContent>
      </Card>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this attendance record.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSelectedAttendanceIdForDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  className={buttonVariants({ variant: "destructive" })}
                  onClick={() => selectedAttendanceIdForDelete && handleDeleteAttendance(selectedAttendanceIdForDelete)}
                >
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isCheckoutAlertOpen} onOpenChange={setIsCheckoutAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Manually Check-Out User?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will mark <span className="font-semibold">{selectedAttendanceForCheckout?.studentName}</span> as checked-out at the current time. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSelectedAttendanceForCheckout(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => handleAdminCheckout(selectedAttendanceForCheckout)}
                >
                    Confirm Check-out
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
