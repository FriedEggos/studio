
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
import { ArrowLeft, Calendar, MapPin, Link as LinkIcon, Copy, Users, Download, Trash2 } from "lucide-react";
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
import { useState, useEffect } from "react";

interface Program {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  qrSlug: string;
  redirectUrl?: string;
}

interface Attendance {
    id: string;
    studentName: string;
    studentId: string;
    classGroup: string;
    createdAt: {
        toDate: () => Date;
    } | null;
}


export default function ProgramDetailsPage() {
  const params = useParams();
  const programId = params.programId as string;
  const firestore = useFirestore();
  const { toast } = useToast();
  const [qrFormUrl, setQrFormUrl] = useState('');
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);

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

  useEffect(() => {
    if (typeof window !== 'undefined' && program?.qrSlug) {
      setQrFormUrl(`${window.location.origin}/p/${program.qrSlug}`);
    }
  }, [program]);


  const handleCopyLink = () => {
    if (!qrFormUrl) return;
    navigator.clipboard.writeText(qrFormUrl);
    toast({ title: "Link Copied!", description: "The QR form link has been copied to your clipboard." });
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
      'Timestamp': att.createdAt ? format(att.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
    }));
    
    exportToCsv(`attendance_${program?.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`, dataToExport);
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
    setIsAlertOpen(false);
    setSelectedAttendanceId(null);
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
                    <CardHeader> <CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" /> Dates</CardTitle> </CardHeader>
                    <CardContent>
                        <p><strong>Start:</strong> {format(parseISO(program.startDate), 'PPP')}</p>
                        <p><strong>End:</strong> {format(parseISO(program.endDate), 'PPP')}</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader> <CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5" /> Location</CardTitle> </CardHeader>
                    <CardContent> <p>{program.location}</p> </CardContent>
                </Card>
            </div>
        </CardContent>
      </Card>
      
      <div className="grid md:grid-cols-2 gap-6 items-start">
        <Card>
            <CardHeader><CardTitle className="font-headline flex items-center gap-2"><LinkIcon className="h-5 w-5" /> QR Form Link</CardTitle></CardHeader>
            <CardContent>
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted">
                    <p className="text-sm text-muted-foreground truncate flex-1">{qrFormUrl || 'Generating link...'}</p>
                    <Button variant="ghost" size="icon" onClick={handleCopyLink} disabled={!qrFormUrl}><Copy className="h-4 w-4" /></Button>
                </div>
            </CardContent>
        </Card>
        {qrFormUrl ? (
          <QRImageCard qrFormUrl={qrFormUrl} />
        ) : (
           <Card>
            <CardHeader>
              <CardTitle className="font-headline">QR Code</CardTitle>
              <CardDescription>
                Generating QR code...
              </CardDescription>
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
            <Button onClick={handleExport} disabled={isLoadingAttendances || !attendances || attendances.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </CardHeader>
          <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Check-in Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingAttendances ? (
                     [...Array(3)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : attendances && attendances.length > 0 ? (
                    attendances.map((att) => (
                      <TableRow key={att.id}>
                        <TableCell className="font-medium">{att.studentName}</TableCell>
                        <TableCell>{att.studentId || '-'}</TableCell>
                        <TableCell>{att.classGroup || '-'}</TableCell>
                        <TableCell>{att.createdAt ? format(att.createdAt.toDate(), 'Pp') : <span className="text-muted-foreground">Syncing...</span>}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                                setSelectedAttendanceId(att.id);
                                setIsAlertOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete attendance</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        No attendances recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
          </CardContent>
      </Card>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this attendance record.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSelectedAttendanceId(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  className={buttonVariants({ variant: "destructive" })}
                  onClick={() => selectedAttendanceId && handleDeleteAttendance(selectedAttendanceId)}
                >
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    </div>
  );
}
