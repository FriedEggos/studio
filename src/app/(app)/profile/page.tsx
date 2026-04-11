'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { AlertCircle, Users, Award, Download } from "lucide-react";
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collectionGroup, getDocs, query, where, collection } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getInitials, cn, getCheckoutStatusColor } from '@/lib/utils';


// Schemas and Types
interface UserProfile {
    id: string;
    displayName: string;
    email: string;
    role: 'student' | 'admin';
    matricId?: string;
    phoneNumber?: string;
    course?: string;
    photoURL?: string;
}

interface Program {
    id: string;
    title: string;
}

interface AttendanceRecord {
    id: string;
    programId: string;
    createdAt: { toDate: () => Date };
    checkOutAt?: { toDate: () => Date };
    checkOutStatus?: 'ok' | 'too_early' | 'outside_window' | 'too_short' | 'admin_override';
}

interface ParticipationHistoryItem extends AttendanceRecord {
    programTitle: string;
}

interface Position {
    id: string;
    userId: string;
    userName: string;
    matricId: string;
    course: string;
    positionName: string;
    customPositionDetail?: string;
    programName: string;
    peringkat: string;
    verificationStatus: 'pending' | 'approved' | 'rejected' | 'awaiting_evidence';
    createdAt: { toDate: () => Date };
}

// Profile Page Component
export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  // Data Fetching Hooks
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const [history, setHistory] = useState<ParticipationHistoryItem[]>([]);
  
  const positionsQuery = useMemoFirebase(() => user ? collection(firestore, `users/${user.uid}/positions`) : null, [user, firestore]);
  const { data: positions, isLoading: isLoadingPositions } = useCollection<Position>(positionsQuery);

  const allProgramsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'programs') : null, [firestore]);
  const { data: allPrograms, isLoading: isLoadingPrograms } = useCollection<Program>(allProgramsQuery);

  const userAttendancesQuery = useMemoFirebase(() => {
    if (!user?.email || !firestore) return null;
    return query(collectionGroup(firestore, 'attendances'), where('email', '==', user.email));
  }, [user, firestore]);
  const { data: userAttendances, isLoading: isLoadingAttendances } = useCollection<AttendanceRecord>(userAttendancesQuery);

  const isLoading = isUserLoading || isProfileLoading || isLoadingPositions || isLoadingPrograms || isLoadingAttendances;

  const approvedPositions = useMemo(() => positions?.filter(p => p.verificationStatus === 'approved') || [], [positions]);

  // Effects
  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (!allPrograms || !userAttendances) {
        setHistory([]);
        return;
    };

    const programsMap = new Map(allPrograms.map(p => [p.id, p.title]));
    
    const participationHistory = userAttendances
        .map(att => ({
            ...att,
            programTitle: programsMap.get(att.programId) || 'Unknown Program',
        }))
        .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
    
    setHistory(participationHistory);

  }, [allPrograms, userAttendances]);

  const handleDownloadParticipationPdf = () => {
    if (!history || history.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No History',
            description: 'You have no participation history to download.',
        });
        return;
    }
    if (!userProfile) return;

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Program Participation History', 14, 22);
    doc.setFontSize(12);
    doc.text(`Student Name: ${userProfile.displayName}`, 14, 30);
    doc.text(`Matric ID: ${userProfile.matricId || 'N/A'}`, 14, 36);
    doc.text(`Email: ${userProfile.email}`, 14, 42);

    const getStatusText = (item: ParticipationHistoryItem) => {
        if (!item.checkOutAt) return 'No Checkout';
        switch (item.checkOutStatus) {
            case 'ok':
            case 'admin_override':
                return 'Verified';
            case 'too_early':
            case 'outside_window':
            case 'too_short':
            default:
                return 'Invalid';
        }
    };

    autoTable(doc, {
        startY: 51,
        head: [['No.', 'Program Name', 'Date Joined', 'Check-out Time', 'Status']],
        body: history.map((item, index) => [
            index + 1,
            item.programTitle,
            item.createdAt ? format(item.createdAt.toDate(), 'Pp') : '-',
            item.checkOutAt ? format(item.checkOutAt.toDate(), 'Pp') : '-',
            getStatusText(item)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [37, 51, 89] },
    });

    const pageHeight = doc.internal.pageSize.getHeight();
    const signatureX = 14;

    let finalY = (doc as any).lastAutoTable.finalY || pageHeight - 70;
    let signatureY = finalY + 25;

    // Check if there is enough space on the current page for the signature
    if (signatureY > pageHeight - 50) {
        doc.addPage();
        signatureY = 40; // Start at top of new page
    }
    
    doc.setFontSize(10);
    doc.text('_______________________________', signatureX, signatureY);
    doc.text('PENYELARAS KELAB ICT JTMK', signatureX, signatureY + 6);
    doc.text('POLITEKNIK KUCHING SARAWAK', signatureX, signatureY + 12);
    doc.text('Nama:', signatureX, signatureY + 22);
    doc.text('Tarikh:', signatureX, signatureY + 28);

    doc.save(`JTMK_Participation_${userProfile.displayName.replace(' ', '_')}.pdf`);
  };

  // Loading and Error States
  if (isLoading || !user || !userProfile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <Card><CardHeader><Skeleton className="w-24 h-24"/><Skeleton className="h-6 w-48"/></CardHeader><CardContent><Skeleton className="h-40 w-full"/></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-8 w-32"/></CardHeader><CardContent><Skeleton className="h-20 w-full"/></CardContent></Card>
      </div>
    );
  }

  if (userProfile.role === 'admin') {
      return (
         <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>This profile page is for students. Go to the <Link href="/admin/dashboard" className="font-bold underline">Admin Dashboard</Link>.</AlertDescription>
        </Alert>
      )
  }

  // Render
  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">My Profile</h1>

        <Card>
          <CardHeader className="items-center text-center">
            <Link href="/profile/edit">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarImage src={user.photoURL || `https://ui-avatars.com/api/?name=${getInitials(userProfile.displayName || '')}&background=random&color=fff`} />
                <AvatarFallback>{getInitials(userProfile.displayName || user.email || '')}</AvatarFallback>
              </Avatar>
            </Link>
            <CardTitle className="font-headline">{userProfile?.displayName?.toUpperCase() || "JTMK Student"}</CardTitle>
            <CardDescription>{userProfile?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 my-4 text-sm border-t pt-4">
              <div className="flex justify-between items-center"><span className="font-semibold text-muted-foreground">Matric ID</span><span>{userProfile?.matricId?.toUpperCase() || 'Not set'}</span></div>
              <div className="flex justify-between items-center"><span className="font-semibold text-muted-foreground">Phone Number</span><span>{userProfile?.phoneNumber || 'Not set'}</span></div>
              <div className="flex justify-between items-center"><span className="font-semibold text-muted-foreground">Department</span><span>{userProfile?.course || 'Not set'}</span></div>
            </div>
            <Button className="w-full" asChild><Link href="/profile/edit">Update Profile</Link></Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Programs Attended</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{history.length}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Verified Involvements</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{approvedPositions.length}</div>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Program Participation History</CardTitle>
                    <CardDescription>A record of all programs you have attended.</CardDescription>
                </div>
                 <Button variant="outline" size="sm" onClick={handleDownloadParticipationPdf} disabled={history.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Program Name</TableHead><TableHead>Date Joined</TableHead><TableHead>Check-out Time</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? ([...Array(3)].map((_, i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell></TableRow>))
                        : history.length > 0 ? (history.map((item, index) => (
                            <TableRow key={item.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell className="font-medium">{item.programTitle}</TableCell>
                                <TableCell>{item.createdAt ? format(item.createdAt.toDate(), 'Pp') : '-'}</TableCell>
                                <TableCell className={cn(item.checkOutAt ? getCheckoutStatusColor(item.checkOutStatus) : 'text-muted-foreground font-medium')}>
                                    {item.checkOutAt ? format(item.checkOutAt.toDate(), 'Pp') : 'No Checkout'}
                                </TableCell>
                            </TableRow>
                        )))
                        : (<TableRow><TableCell colSpan={4} className="h-24 text-center">You have not joined any programs yet.</TableCell></TableRow>)}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </>
  );
}
