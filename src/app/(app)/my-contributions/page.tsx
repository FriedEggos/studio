
'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
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
import { AlertCircle, PlusCircle, Loader2, Download, BadgeCheck, Edit, Trash2, Eye } from "lucide-react";
import { useUser, useFirestore, useMemoFirebase, useCollection, useDoc, useStorage } from "@/firebase";
import { doc, collection, addDoc, serverTimestamp, deleteDoc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isProfileComplete } from '@/lib/utils';
import Link from 'next/link';
import { useIsMobile } from '@/hooks/use-mobile';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


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
    semester: string;
    className: string;
    verificationStatus: 'pending' | 'approved' | 'rejected' | 'awaiting_evidence';
    rejectionRemark?: string;
    createdAt: { toDate: () => Date };
    evidenceUrl?: string;
    evidenceStoragePath?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const positionSchema = z.object({
  programName: z.string().min(1, "Nama program diperlukan."),
  peringkat: z.string().min(1, "Peringkat diperlukan."),
  positionName: z.string().min(1, "Jawatan diperlukan."),
  customPositionDetail: z.string().optional(),
  semester: z.string().min(1, "Semester diperlukan."),
  className: z.string().min(1, "Kelas diperlukan."),
  submissionType: z.enum(['with_photo', 'no_photo'], {
    required_error: "Sila pilih jenis penghantaran.",
  }),
  evidence: z.any().optional(),
}).refine(data => {
    if (data.positionName === "AJK Lain-Lain") {
        return !!data.customPositionDetail && data.customPositionDetail.length > 0;
    }
    return true;
}, {
    message: "Details are required for 'AJK Lain-Lain'.",
    path: ['customPositionDetail'],
}).superRefine((data, ctx) => {
    if (data.submissionType === 'with_photo') {
        const { evidence } = data;
        if (!evidence || evidence.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Satu fail bukti diperlukan.",
                path: ['evidence'],
            });
            return;
        }
        if (evidence[0].size > MAX_FILE_SIZE) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Saiz fail maksimum ialah 10MB.`,
                path: ['evidence'],
            });
        }
        if (!ACCEPTED_IMAGE_TYPES.includes(evidence[0].type)) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Hanya format .jpeg, .jpg, .png, and .webp diterima.",
                path: ['evidence'],
            });
        }
    }
});

const positionOptions = [
  "Pengerusi",
  "Naib Pengerusi",
  "Pengarah Program",
  "Timbalan Pengarah Program",
  "Setiausaha",
  "Bendahari",
  "Penolong Setiausaha",
  "Penolong Bendahari",
  "AJK Lain-Lain",
  "Peserta",
];

const peringkatOptions = [
    "Peringkat Kelab",
    "Peringkat Program",
    "Peringkat Jabatan",
    "Peringkat Politeknik",
    "Peringkat Zon / Negeri",
    "Peringkat Kebangsaan",
    "Peringkat Antarabangsa",
    "Peringkat Komuniti",
    "Tiada"
];

const semesterOptions = Array.from({ length: 9 }, (_, i) => (i + 1).toString());
const classOptions = [
    "DIT1A", "DIT1B", "DIT1C",
    "DIT2A", "DIT2B", "DIT2C", "DIT2D",
    "DIT3A", "DIT3B", "DIT3C", "DIT3D",
    "DIT4A", "DIT4B", "DIT4C", "DIT4D",
    "DIT5A", "DIT5B", "DIT5C", "DIT5D",
    "Lain-lain"
];


// Page Component
export default function MyContributionsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [positionToDelete, setPositionToDelete] = useState<Position | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedRemarks, setExpandedRemarks] = useState<Record<string, boolean>>({});
  const [remarkInModal, setRemarkInModal] = useState<string | null>(null);

  const toggleRemark = (positionId: string) => {
    setExpandedRemarks(prev => ({
      ...prev,
      [positionId]: !prev[positionId]
    }));
  };

  // Data Fetching Hooks
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const positionsQuery = useMemoFirebase(() => user ? collection(firestore, `users/${user.uid}/positions`) : null, [user, firestore]);
  const { data: positions, isLoading: isLoadingPositions } = useCollection<Position>(positionsQuery);

  // Form Management
  const form = useForm<z.infer<typeof positionSchema>>({
    resolver: zodResolver(positionSchema),
    defaultValues: { programName: '', peringkat: '', positionName: '', customPositionDetail: '', semester: '', className: '' },
  });
  const watchPositionName = form.watch('positionName');
  const watchSubmissionType = form.watch('submissionType');
  const [isSubmittingPosition, setIsSubmittingPosition] = useState(false);

  // Derived state for UI logic
  const profileComplete = isProfileComplete(userProfile);
  const hasPending = useMemo(() => positions?.some(p => p.verificationStatus === 'pending'), [positions]);
  const approvedPositions = useMemo(() => positions?.filter(p => p.verificationStatus === 'approved') || [], [positions]);
  const displayedPositions = useMemo(() => positions?.filter(p => p.verificationStatus !== 'awaiting_evidence') || [], [positions]);

  // Effects
  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [isUserLoading, user, router]);

  // Form Submission
  const onPositionSubmit = async (values: z.infer<typeof positionSchema>) => {
    if (!user || !userProfile || !positionsQuery || !storage) return;
    setIsSubmittingPosition(true);
    
    const newPositionRef = doc(collection(firestore, 'users', user.uid, 'positions'));
    const positionId = newPositionRef.id;
    let evidenceUrl = "";
    let filePath = "";

    try {
        if (values.submissionType === 'with_photo' && values.evidence && values.evidence.length > 0) {
            const file = values.evidence[0] as File;
            filePath = `contributions/${user.uid}/${positionId}/${file.name}`;
            const fileRef = storageRef(storage, filePath);
            
            await uploadBytes(fileRef, file);
            evidenceUrl = await getDownloadURL(fileRef);
        }

        await setDoc(newPositionRef, {
            id: positionId,
            userId: user.uid,
            userName: userProfile.displayName,
            matricId: userProfile.matricId,
            course: userProfile.course,
            programName: values.programName.toUpperCase(),
            peringkat: values.peringkat,
            positionName: values.positionName,
            customPositionDetail: values.customPositionDetail || "",
            semester: parseInt(values.semester),
            className: values.className,
            evidenceUrl: evidenceUrl, // This will be empty if no photo
            evidenceStoragePath: filePath, // This will be empty if no photo
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

  const handleConfirmDelete = async () => {
    if (!user || !positionToDelete || !firestore || !storage) return;
    setIsDeleting(true);
    
    const docRef = doc(firestore, 'users', user.uid, 'positions', positionToDelete.id);

    try {
        // First, delete the document from Firestore
        await deleteDoc(docRef);

        // If that succeeds, delete the file from Storage
        if (positionToDelete.evidenceStoragePath) {
            const fileRef = storageRef(storage, positionToDelete.evidenceStoragePath);
            await deleteObject(fileRef);
        }

        toast({
            title: 'Success',
            description: 'The contribution record and its proof have been deleted.',
        });
    } catch (e) {
        console.error("Error deleting position:", e);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not delete the record. Please try again.',
        });
    } finally {
        setPositionToDelete(null);
        setIsDeleteAlertOpen(false);
        setIsDeleting(false);
    }
  };


  const handleDownloadContributionsPdf = () => {
    if (!approvedPositions || approvedPositions.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Approved Positions',
        description: 'You have no approved positions to download.',
      });
      return;
    }
    if (!userProfile) return;

    const doc = new jsPDF();
    
    // PDF Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text('REKOD SUMBANGAN PELAJAR JTMK', doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    // Student Details Header
    let startY = 35;
    doc.text(`Nama: ${userProfile.displayName}`, 14, startY);
    startY += 6;
    doc.text(`No. Matrik: ${userProfile.matricId || 'N/A'}`, 14, startY);
    startY += 6;
    doc.text(`Email: ${userProfile.email}`, 14, startY);
    startY += 10; // Add space before table

    autoTable(doc, {
      startY: startY,
      head: [['No.', 'Program', 'Peringkat', 'Jawatan', 'Semester', 'Kelas', 'Tarikh']],
      body: approvedPositions.map((p, index) => [
        index + 1,
        p.programName,
        p.peringkat,
        p.positionName === 'AJK Lain-Lain' ? `${p.positionName} (${p.customPositionDetail})` : p.positionName,
        p.semester,
        p.className,
        p.createdAt ? format(p.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A',
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

    doc.save(`JTMK_Involvement_${userProfile.displayName.replace(' ', '_')}.pdf`);
  };

  // Loading and Error States
  if (isUserLoading || isProfileLoading || !user || !userProfile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Contributions</h1>
        <Card><CardHeader><Skeleton className="h-8 w-32"/></CardHeader><CardContent><Skeleton className="h-40 w-full"/></CardContent></Card>
      </div>
    );
  }
  
  if (userProfile.role === 'admin') {
    return (
       <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>This page is for students. Go to the <Link href="/admin/dashboard" className="font-bold underline">Admin Dashboard</Link>.</AlertDescription>
      </Alert>
    )
}

  // Render
  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">My Contributions</h1>
        
        {/* Contributions Section */}
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Claim a Position</CardTitle>
                  <CardDescription>Claim positions you held in programs for admin verification.</CardDescription>
                </div>
                <Button variant="outline" onClick={handleDownloadContributionsPdf} disabled={approvedPositions.length === 0}>
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
                           Borang permohonan akan dibuka semula selepas permohonan semasa disahkan. Anda masih boleh menyunting permohonan yang sedia ada.
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
                                <FormField control={form.control} name="semester" render={({ field }) => (
                                    <FormItem><FormLabel>Semester</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!profileComplete}><FormControl><SelectTrigger><SelectValue placeholder="Pilih semester" /></SelectTrigger></FormControl><SelectContent>{semesterOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="className" render={({ field }) => (
                                    <FormItem><FormLabel>Kelas</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!profileComplete}><FormControl><SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger></FormControl><SelectContent>{classOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                
                                <FormField
                                    control={form.control}
                                    name="submissionType"
                                    render={({ field }) => (
                                    <FormItem className="space-y-3 md:col-span-2">
                                        <FormLabel>Jenis Bukti</FormLabel>
                                        <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex items-center space-x-4 pt-2"
                                            disabled={!profileComplete}
                                        >
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="with_photo" id="with_photo" /></FormControl>
                                                <FormLabel htmlFor="with_photo" className="font-normal cursor-pointer">Dengan Gambar</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="no_photo" id="no_photo" /></FormControl>
                                                <FormLabel htmlFor="no_photo" className="font-normal cursor-pointer">Tanpa Gambar</FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                                {watchSubmissionType === 'with_photo' && (
                                    <FormField
                                        control={form.control}
                                        name="evidence"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-2">
                                            <FormLabel>Fail Bukti (Gambar, Max 10MB)</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    type="file" 
                                                    accept="image/png, image/jpeg, image/webp"
                                                    disabled={!profileComplete}
                                                    onChange={(e) => field.onChange(e.target.files)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
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
                                            <p>Complete your profile on the 'My Profile' page to submit contributions.</p>
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
                            <TableHead>Proof</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingPositions ? ([...Array(2)].map((_, i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell></TableRow>))
                        : displayedPositions && displayedPositions.length > 0 ? (displayedPositions.map((pos, index) => {
                            const isRejectedWithRemark = pos.verificationStatus === 'rejected' && pos.rejectionRemark;
                            const isExpanded = expandedRemarks[pos.id] || false;
                            const isLongRemark = isRejectedWithRemark && pos.rejectionRemark.length > 100;
                            
                            return (
                                <React.Fragment key={pos.id}>
                                    <TableRow className={isRejectedWithRemark ? 'bg-destructive/5' : ''}>
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>{pos.programName}</TableCell>
                                        <TableCell>{pos.peringkat}</TableCell>
                                        <TableCell>
                                          {pos.positionName}
                                          {pos.customPositionDetail && <span className="text-muted-foreground text-xs ml-2">({pos.customPositionDetail})</span>}
                                        </TableCell>
                                        <TableCell>
                                            {pos.evidenceUrl ? (
                                                <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                                                    <Link href={pos.evidenceUrl} target="_blank" rel="noopener noreferrer">
                                                        <Eye className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            ) : (
                                                'N/A'
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {(() => {
                                                if (pos.verificationStatus === 'approved') {
                                                    return (
                                                        <Badge className="bg-green-100 text-green-800 border border-green-200 hover:bg-green-100/80 capitalize">
                                                            <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                                                            Approved
                                                        </Badge>
                                                    );
                                                }
                                                if (isRejectedWithRemark) {
                                                    if (isMobile) {
                                                        return (
                                                            <Badge variant="destructive" className="capitalize cursor-pointer" onClick={() => toggleRemark(pos.id)}>
                                                                Rejected
                                                            </Badge>
                                                        );
                                                    }
                                                    return (
                                                        <div className="flex items-center gap-1">
                                                            <Badge variant="destructive" className="capitalize">Rejected</Badge>
                                                            {isLongRemark ? (
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={() => setRemarkInModal(pos.rejectionRemark!)}>
                                                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            ) : (
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6 cursor-help">
                                                                            <AlertCircle className="h-4 w-4 text-destructive" />
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="max-w-xs">
                                                                        <p className="font-semibold text-destructive">Admin Remark:</p>
                                                                        <p className="text-sm text-muted-foreground">{pos.rejectionRemark}</p>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            )}
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <Badge variant={pos.verificationStatus === 'pending' ? 'secondary' : 'destructive'} className="capitalize">
                                                        {pos.verificationStatus}
                                                    </Badge>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {(pos.verificationStatus === 'pending' || pos.verificationStatus === 'rejected') && (
                                                <div className="flex gap-2 justify-end">
                                                    <Button asChild size="sm" variant="outline">
                                                        <Link href={`/my-contributions/${pos.id}/edit`}>
                                                            <Edit className="mr-2 h-3.5 w-3.5" />
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => {
                                                            setPositionToDelete(pos);
                                                            setIsDeleteAlertOpen(true);
                                                        }}
                                                    >
                                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                        Delete
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                    {isMobile && isRejectedWithRemark && isExpanded && (
                                        <tr className="bg-destructive/5 border-b border-destructive/10">
                                            <td colSpan={7} className="px-6 py-4">
                                                <div className="flex items-start gap-3">
                                                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <h4 className="font-semibold text-destructive mb-1">Admin Remark</h4>
                                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{pos.rejectionRemark}</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        }))
                        : (<TableRow><TableCell colSpan={7} className="h-24 text-center">No positions submitted yet.</TableCell></TableRow>)}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete this contribution record for "{positionToDelete?.programName}". This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPositionToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!remarkInModal} onOpenChange={(open) => !open && setRemarkInModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Remark</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground whitespace-pre-wrap">
            {remarkInModal}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
