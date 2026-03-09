
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle, Users, Award, PlusCircle, Loader2, Download, BadgeCheck } from "lucide-react";
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collectionGroup, getDocs, query, where, collection, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getInitials, isProfileComplete } from '@/lib/utils';


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

interface ParticipationHistoryItem {
    id: string;
    programTitle: string;
    createdAt: { toDate: () => Date };
    checkOutAt?: { toDate: () => Date };
}

interface Position {
    id: string;
    positionName: string;
    customPositionDetail?: string;
    programName: string;
    peringkat: string;
    verificationStatus: 'pending' | 'approved' | 'rejected' | 'awaiting_evidence';
    createdAt: { toDate: () => Date };
}

const positionSchema = z.object({
  programName: z.string().min(1, "Nama program diperlukan."),
  peringkat: z.string().min(1, "Peringkat diperlukan."),
  positionName: z.string().min(1, "Jawatan diperlukan."),
  customPositionDetail: z.string().optional(),
}).refine(data => {
    if (data.positionName === "AJK Lain-Lain") {
        return !!data.customPositionDetail && data.customPositionDetail.length > 0;
    }
    return true;
}, {
    message: "Details are required for 'AJK Lain-Lain'.",
    path: ['customPositionDetail'],
});

const positionOptions = [
  "Pengerusi", "Naib Pengerusi", "Setiausaha", "Bendahari", 
  "Penolong Setiausaha", "Penolong Bendahari", "AJK Lain-Lain"
];

const peringkatOptions = [
    "Peringkat Antarabangsa",
    "Peringkat Kebangsaan",
    "Peringkat Negeri",
    "Peringkat Daerah",
    "Peringkat Institusi / Universiti / Politeknik",
    "Peringkat Jabatan / Kelab / Persatuan"
];


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
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const positionsQuery = useMemoFirebase(() => user ? collection(firestore, `users/${user.uid}/positions`) : null, [user, firestore]);
  const { data: positions, isLoading: isLoadingPositions } = useCollection<Position>(positionsQuery);

  // Form Management
  const form = useForm<z.infer<typeof positionSchema>>({
    resolver: zodResolver(positionSchema),
    defaultValues: { positionName: '', programName: '', customPositionDetail: '', peringkat: '' },
  });
  const watchPositionName = form.watch('positionName');
  const [isSubmittingPosition, setIsSubmittingPosition] = useState(false);

  // Derived state for UI logic
  const profileComplete = isProfileComplete(userProfile);
  const hasPending = useMemo(() => positions?.some(p => p.verificationStatus === 'pending'), [positions]);
  const approvedPositions = useMemo(() => positions?.filter(p => p.verificationStatus === 'approved') || [], [positions]);
  const displayedPositions = useMemo(() => positions?.filter(p => p.verificationStatus !== 'rejected' && p.verificationStatus !== 'awaiting_evidence') || [], [positions]);

  // Effects
  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (!user?.email || !firestore) return;
    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const programsSnap = await getDocs(collection(firestore, 'programs'));
            const programsMap = new Map(programsSnap.docs.map(d => [d.id, d.data().title]));
            const attendancesSnap = await getDocs(query(collectionGroup(firestore, 'attendances'), where('email', '==', user.email)));
            const participationHistory = attendancesSnap.docs
                .map(d => ({ id: `${d.ref.parent.parent?.id}_${d.id}`, programTitle: programsMap.get(d.ref.parent.parent?.id) || 'Unknown Program', ...d.data() }))
                .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
            setHistory(participationHistory as ParticipationHistoryItem[]);
        } catch (error) {
            console.error("Error fetching participation history:", error);
            toast({ variant: "destructive", title: "Could not load history" });
        } finally {
            setIsLoadingHistory(false);
        }
    };
    fetchHistory();
  }, [user, firestore, toast]);

  // Form Submission
  const onPositionSubmit = async (values: z.infer<typeof positionSchema>) => {
    if (!user || !userProfile || !positionsQuery) return;
    setIsSubmittingPosition(true);
    try {
        await addDoc(positionsQuery, {
            userId: user.uid,
            userName: userProfile.displayName,
            ...values,
            verificationStatus: 'pending',
            createdAt: serverTimestamp(),
        });
        toast({ title: 'Success!', description: 'Your position has been submitted for verification.' });
        form.reset();
    } catch (error: any) {
        console.error("Error submitting position:", error);
        toast({ 
            variant: 'destructive', 
            title: 'Submission Failed', 
            description: error.message.includes('permission-denied') 
                ? "Your profile must be complete to submit contributions."
                : "An unexpected error occurred."
        });
    } finally {
        setIsSubmittingPosition(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!positions || !userProfile) return;

    const approvedPositions = positions.filter(p => p.verificationStatus === 'approved');

    if (approvedPositions.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Approved Positions',
        description: 'You have no approved positions to download.',
      });
      return;
    }

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Verified Committee Involvement List', 14, 22);
    doc.setFontSize(12);
    doc.text(`Student Name: ${userProfile.displayName}`, 14, 30);
    doc.text(`Email: ${userProfile.email}`, 14, 36);

    autoTable(doc, {
      startY: 45,
      head: [['No.', 'Program', 'Level', 'Position', 'Date', 'Status']],
      body: approvedPositions.map((p, index) => [
        index + 1,
        p.programName,
        p.peringkat,
        p.positionName === 'AJK Lain-Lain' ? `${p.positionName} (${p.customPositionDetail})` : p.positionName,
        p.createdAt ? format(p.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A',
        'Approved'
      ]),
      theme: 'grid',
      headStyles: { fillColor: [37, 51, 89] },
    });

    doc.save(`JTMK_Involvement_${userProfile.displayName.replace(' ', '_')}.pdf`);
  };

  // Loading and Error States
  if (isUserLoading || isProfileLoading || isLoadingHistory || !user || !userProfile) {
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
            <CardTitle className="font-headline">{userProfile?.displayName || "JTMK Student"}</CardTitle>
            <CardDescription>{userProfile?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 my-4 text-sm border-t pt-4">
              <div className="flex justify-between items-center"><span className="font-semibold text-muted-foreground">Matric ID</span><span>{userProfile?.matricId || 'Not set'}</span></div>
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
        
        {/* Contributions Section */}
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>My Contributions</CardTitle>
                  <CardDescription>Claim positions you held in programs for admin verification.</CardDescription>
                </div>
                <Button variant="outline" onClick={handleDownloadPdf} disabled={approvedPositions.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                </Button>
            </CardHeader>
            <CardContent>
                {hasPending ? (
                     <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Permohonan anda sedang disemak</AlertTitle>
                        <AlertDescription>
                           Borang permohonan akan dibuka semula selepas permohonan semasa disahkan.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onPositionSubmit)} className="space-y-4 p-4 border rounded-lg mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="programName" render={({ field }) => (
                                    <FormItem><FormLabel>Nama Program</FormLabel><FormControl><Input placeholder="Nama penuh program" {...field} disabled={!profileComplete} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="peringkat" render={({ field }) => (
                                    <FormItem><FormLabel>Peringkat</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!profileComplete}><FormControl><SelectTrigger><SelectValue placeholder="Pilih peringkat" /></SelectTrigger></FormControl><SelectContent>{peringkatOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="positionName" render={({ field }) => (
                                    <FormItem><FormLabel>Jawatan</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!profileComplete}><FormControl><SelectTrigger><SelectValue placeholder="Pilih jawatan" /></SelectTrigger></FormControl><SelectContent>{positionOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                {watchPositionName === 'AJK Lain-Lain' && (
                                    <FormField control={form.control} name="customPositionDetail" render={({ field }) => (
                                        <FormItem><FormLabel>Butiran Jawatan</FormLabel><FormControl><Input placeholder="e.g., Ketua Multimedia" {...field} disabled={!profileComplete} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                )}
                            </div>

                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        {/* The TooltipTrigger needs a child that can accept a ref, so we wrap the Button */}
                                        <div className="w-full">
                                            <Button type="submit" disabled={!profileComplete || isSubmittingPosition} className="w-full">
                                                {isSubmittingPosition ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menghantar...</> : <> <PlusCircle className="mr-2 h-4 w-4" /> Hantar untuk Pengesahan</>}
                                            </Button>
                                        </div>
                                    </TooltipTrigger>
                                    {!profileComplete && (
                                        <TooltipContent>
                                            <p>You must update your Personal Details before you can submit a contribution for verification.</p>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>

                        </form>
                    </Form>
                )}
                
                <h3 className="text-md font-semibold mt-6 mb-2">Submitted Positions</h3>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>No.</TableHead>
                            <TableHead>Program</TableHead>
                            <TableHead>Level</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingPositions ? ([...Array(2)].map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell></TableRow>))
                        : displayedPositions && displayedPositions.length > 0 ? (displayedPositions.map((pos, index) => (
                            <TableRow key={pos.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{pos.programName}</TableCell>
                                <TableCell>{pos.peringkat}</TableCell>
                                <TableCell>
                                  {pos.positionName}
                                  {pos.customPositionDetail && <span className="text-muted-foreground text-xs ml-2">({pos.customPositionDetail})</span>}
                                </TableCell>
                                <TableCell>{pos.createdAt ? format(pos.createdAt.toDate(), 'dd/MM/yyyy') : ''}</TableCell>
                                <TableCell>
                                    {pos.verificationStatus === 'approved' ? (
                                        <Badge className="bg-green-100 text-green-800 border border-green-200 hover:bg-green-100/80 capitalize">
                                            <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                                            Approved
                                        </Badge>
                                    ) : (
                                        <Badge variant={pos.verificationStatus === 'pending' ? 'secondary' : 'destructive'} className="capitalize">
                                            {pos.verificationStatus}
                                        </Badge>
                                    )}
                                </TableCell>
                            </TableRow>
                        )))
                        : (<TableRow><TableCell colSpan={6} className="h-24 text-center">No positions submitted yet.</TableCell></TableRow>)}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle>Program Participation History</CardTitle><CardDescription>A record of all programs you have attended.</CardDescription></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Program Name</TableHead><TableHead>Date Joined</TableHead><TableHead>Check-out Time</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoadingHistory ? ([...Array(3)].map((_, i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell></TableRow>))
                        : history.length > 0 ? (history.map((item, index) => (
                            <TableRow key={item.id}><TableCell>{index + 1}</TableCell><TableCell className="font-medium">{item.programTitle}</TableCell><TableCell>{item.createdAt ? format(item.createdAt.toDate(), 'Pp') : '-'}</TableCell><TableCell>{item.checkOutAt ? format(item.checkOutAt.toDate(), 'Pp') : '-'}</TableCell></TableRow>
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
