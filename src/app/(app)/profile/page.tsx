
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
import { Camera, AlertCircle, Users, Award, PlusCircle, Loader2, Download } from "lucide-react";
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collectionGroup, getDocs, query, where, collection, addDoc, serverTimestamp } from "firebase/firestore";
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
    verificationStatus: 'pending' | 'approved' | 'rejected';
}

const positionSchema = z.object({
  positionName: z.string().min(1, "Jawatan diperlukan."),
  programName: z.string().min(1, "Nama program diperlukan."),
  customPositionDetail: z.string().optional(),
}).refine(data => {
    if (data.positionName === "AJK Lain-Lain") {
        return !!data.customPositionDetail && data.customPositionDetail.length > 0;
    }
    return true;
}, {
    message: "Butiran diperlukan untuk 'AJK Lain-Lain'.",
    path: ['customPositionDetail'],
});

const positionOptions = [
  "Pengerusi", "Naib Pengerusi", "Setiausaha", "Bendahari", 
  "Penolong Setiausaha", "Penolong Bendahari", "AJK Lain-Lain"
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
    defaultValues: { positionName: '', programName: '', customPositionDetail: '' },
  });
  const watchPositionName = form.watch('positionName');
  const [isSubmittingPosition, setIsSubmittingPosition] = useState(false);

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
        toast({ title: 'Berjaya!', description: 'Jawatan anda telah dihantar untuk pengesahan.' });
        form.reset();
    } catch (error) {
        console.error("Error submitting position:", error);
        toast({ variant: 'destructive', title: 'Penghantaran Gagal' });
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
        title: 'Tiada Jawatan Diluluskan',
        description: 'Anda tiada jawatan yang diluluskan untuk dimuat turun.',
      });
      return;
    }

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Senarai Penglibatan Jawatankuasa Yang Disahkan', 14, 22);
    doc.setFontSize(12);
    doc.text(`Nama Pelajar: ${userProfile.displayName}`, 14, 30);
    doc.text(`Emel: ${userProfile.email}`, 14, 36);

    autoTable(doc, {
      startY: 45,
      head: [['Nama Program', 'Jawatan']],
      body: approvedPositions.map(p => [
        p.programName,
        p.positionName === 'AJK Lain-Lain' ? `${p.positionName} (${p.customPositionDetail})` : p.positionName
      ]),
      theme: 'grid',
      headStyles: { fillColor: [37, 51, 89] },
    });

    doc.save(`JTMK_Penglibatan_${userProfile.displayName.replace(' ', '_')}.pdf`);
  };
  
  const hasPending = useMemo(() => positions?.some(p => p.verificationStatus === 'pending'), [positions]);
  const approvedPositions = useMemo(() => positions?.filter(p => p.verificationStatus === 'approved') || [], [positions]);
  const displayedPositions = useMemo(() => positions?.filter(p => p.verificationStatus !== 'rejected') || [], [positions]);

  // Loading and Error States
  if (isUserLoading || isProfileLoading || isLoadingHistory || !user || !userProfile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Profil Saya</h1>
        <Card><CardHeader><Skeleton className="w-24 h-24"/><Skeleton className="h-6 w-48"/></CardHeader><CardContent><Skeleton className="h-40 w-full"/></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-8 w-32"/></CardHeader><CardContent><Skeleton className="h-20 w-full"/></CardContent></Card>
      </div>
    );
  }

  if (userProfile.role === 'admin') {
      return (
         <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Akses Ditolak</AlertTitle>
            <AlertDescription>Halaman profil ini adalah untuk pelajar. Pergi ke <Link href="/admin/dashboard" className="font-bold underline">Papan Pemuka Admin</Link>.</AlertDescription>
        </Alert>
      )
  }

  // Derived State for UI
  const totalProgramsAttended = history.length;
  const totalInvolvements = approvedPositions.length;

  // Render
  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Profil Saya</h1>

        <Card>
          <CardHeader className="items-center text-center">
            <Link href="/profile/edit" className="relative group">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarImage src={user.photoURL || `https://picsum.photos/seed/${user.uid}/200/200`} />
                <AvatarFallback>{userProfile?.displayName?.[0].toUpperCase() || user.email?.[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 mb-4 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="h-8 w-8 text-white" />
              </div>
            </Link>
            <CardTitle className="font-headline">{userProfile?.displayName || "Pelajar JTMK"}</CardTitle>
            <CardDescription>{userProfile?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 my-4 text-sm border-t pt-4">
              <div className="flex justify-between items-center"><span className="font-semibold text-muted-foreground">ID Matrik</span><span>{userProfile?.matricId || 'Tidak ditetapkan'}</span></div>
              <div className="flex justify-between items-center"><span className="font-semibold text-muted-foreground">Nombor Telefon</span><span>{userProfile?.phoneNumber || 'Tidak ditetapkan'}</span></div>
              <div className="flex justify-between items-center"><span className="font-semibold text-muted-foreground">Jabatan</span><span>{userProfile?.course || 'Tidak ditetapkan'}</span></div>
            </div>
            <Button className="w-full" asChild><Link href="/profile/edit">Kemaskini Profil</Link></Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Jumlah Program Dihadiri</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalProgramsAttended}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Penglibatan Disahkan</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalInvolvements}</div>
                </CardContent>
            </Card>
        </div>
        
        {/* Contributions Section */}
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Sumbangan</CardTitle>
                  <CardDescription>Tuntut jawatan yang anda pegang dalam program untuk pengesahan admin.</CardDescription>
                </div>
                <Button variant="outline" onClick={handleDownloadPdf}>
                    <Download className="mr-2 h-4 w-4" />
                    Muat Turun PDF
                </Button>
            </CardHeader>
            <CardContent>
                {hasPending ? (
                     <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Menunggu Pengesahan</AlertTitle>
                        <AlertDescription>
                           Permohonan jawatan anda sedang disemak. Anda boleh menghantar permohonan baru selepas ini disahkan.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onPositionSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start p-4 border rounded-lg mb-6">
                            <FormField control={form.control} name="positionName" render={({ field }) => (
                                <FormItem><FormLabel>Jawatan</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Pilih jawatan" /></SelectTrigger></FormControl><SelectContent>{positionOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="programName" render={({ field }) => (
                                <FormItem><FormLabel>Nama Program</FormLabel><FormControl><Input placeholder="Nama penuh program" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="grid gap-2">
                                {watchPositionName === 'AJK Lain-Lain' && (
                                    <FormField control={form.control} name="customPositionDetail" render={({ field }) => (
                                        <FormItem><FormLabel>Butiran Jawatan</FormLabel><FormControl><Input placeholder="cth., Ketua Multimedia" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                )}
                            </div>
                            <div className="md:col-span-3">
                            <Button type="submit" disabled={isSubmittingPosition} className="w-full">
                                    {isSubmittingPosition ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menghantar...</> : <> <PlusCircle className="mr-2 h-4 w-4" /> Hantar untuk Pengesahan</>}
                            </Button>
                            </div>
                        </form>
                    </Form>
                )}
                
                <h3 className="text-md font-semibold mt-6 mb-2">Jawatan Dihantar</h3>
                 <Table>
                    <TableHeader><TableRow><TableHead>Program</TableHead><TableHead>Jawatan</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoadingPositions ? ([...Array(2)].map((_, i) => <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-5 w-full" /></TableCell></TableRow>))
                        : displayedPositions && displayedPositions.length > 0 ? (displayedPositions.map(pos => (
                            <TableRow key={pos.id}>
                                <TableCell>{pos.programName}</TableCell>
                                <TableCell>
                                  {pos.positionName}
                                  {pos.customPositionDetail && <span className="text-muted-foreground text-xs ml-2">({pos.customPositionDetail})</span>}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={pos.verificationStatus === 'approved' ? 'default' : pos.verificationStatus === 'rejected' ? 'destructive' : 'secondary'} className="capitalize">{pos.verificationStatus}</Badge>
                                </TableCell>
                            </TableRow>
                        )))
                        : (<TableRow><TableCell colSpan={3} className="h-24 text-center">Tiada jawatan dihantar lagi.</TableCell></TableRow>)}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle>Sejarah Penyertaan Program</CardTitle><CardDescription>Rekod semua program yang telah anda hadiri.</CardDescription></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Nama Program</TableHead><TableHead>Tarikh Sertai</TableHead><TableHead>Masa Daftar Keluar</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoadingHistory ? ([...Array(3)].map((_, i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell></TableRow>))
                        : history.length > 0 ? (history.map((item, index) => (
                            <TableRow key={item.id}><TableCell>{index + 1}</TableCell><TableCell className="font-medium">{item.programTitle}</TableCell><TableCell>{item.createdAt ? format(item.createdAt.toDate(), 'Pp') : '-'}</TableCell><TableCell>{item.checkOutAt ? format(item.checkOutAt.toDate(), 'Pp') : '-'}</TableCell></TableRow>
                        )))
                        : (<TableRow><TableCell colSpan={4} className="h-24 text-center">Belum menyertai sebarang program lagi.</TableCell></TableRow>)}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </>
  );
}

    