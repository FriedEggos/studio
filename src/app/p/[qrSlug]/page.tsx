
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCurrentPosition } from '@/lib/location';
import { createCheckIn } from '@/lib/attendance';

interface Program {
    id: string;
    title: string;
    description: string;
    redirectUrl?: string;
}

interface ProgramConfig {
    copywriting?: string;
    fields: {
        requireStudentId?: boolean;
        requirePhone?: boolean;
        requireEmail?: boolean;
        requireClass?: boolean;
        customInput1Enabled?: boolean;
        customInput1Label?: string;
        customInput2Enabled?: boolean;
        customInput2Label?: string;
    };
}

type PageStatus = 'loading' | 'not_found' | 'form' | 'submitting' | 'success' | 'error';
type ErrorState = {
    title: string;
    message: string;
};

const classOptions = [
    "DIT1A", "DIT1C", "DIT2A", "DIT2B", "DIT2C", "DIT2D", "DIT3A", "DIT3C",
    "DIT4A", "DIT4B", "DIT4C", "DIT4D", "DIT5A", "DIT5C", "LAIN-LAIN"
];

export default function PublicAttendancePage() {
    const params = useParams();
    const qrSlug = params.qrSlug as string;
    const firestore = useFirestore();
    const router = useRouter();

    const [status, setStatus] = useState<PageStatus>('loading');
    const [error, setError] = useState<ErrorState | null>(null);
    const [program, setProgram] = useState<Program | null>(null);
    const [programConfig, setProgramConfig] = useState<ProgramConfig | null>(null);

    const createFormSchema = (config: ProgramConfig | null) => z.object({
        studentName: z.string().min(1, { message: "Nama diperlukan." }),
        studentId: config?.fields.requireStudentId ? z.string().min(1, { message: "ID Pelajar diperlukan." }) : z.string().optional(),
        email: z.string().email({ message: "Format emel tidak sah." }).min(1, { message: "Emel diperlukan." }),
        phone: config?.fields.requirePhone ? z.string().min(1, { message: "Nombor telefon diperlukan." }) : z.string().optional(),
        classGroup: config?.fields.requireClass ? z.string().min(1, { message: "Kelas diperlukan." }) : z.string().optional(),
        customInput1: config?.fields.customInput1Enabled ? z.string().min(1, { message: `${config.fields.customInput1Label} diperlukan.` }) : z.string().optional(),
        customInput2: config?.fields.customInput2Enabled ? z.string().min(1, { message: `${config.fields.customInput2Label} diperlukan.` }) : z.string().optional(),
    });

    const form = useForm<z.infer<ReturnType<typeof createFormSchema>>>({
        resolver: zodResolver(createFormSchema(programConfig)),
        defaultValues: {
            studentName: '',
            studentId: '',
            email: '',
            phone: '',
            classGroup: '',
            customInput1: '',
            customInput2: '',
        },
    });

     useEffect(() => {
        if (programConfig) {
            form.reset(undefined, { keepValues: true });
        }
    }, [programConfig, form]);

    useEffect(() => {
        async function fetchProgramData() {
            if (!firestore || !qrSlug) return;
            try {
                const slugDocRef = doc(firestore, 'qrSlugs', qrSlug);
                const slugSnap = await getDoc(slugDocRef);

                if (!slugSnap.exists()) {
                    setStatus('not_found');
                    return;
                }
                const { programId } = slugSnap.data();

                const programDocRef = doc(firestore, 'programs', programId);
                const configDocRef = doc(firestore, 'programConfigs', programId);

                const [programSnap, configSnap] = await Promise.all([
                    getDoc(programDocRef),
                    getDoc(configDocRef)
                ]);

                if (!programSnap.exists()) {
                    setStatus('not_found');
                    return;
                }
                
                const programData = { id: programSnap.id, ...programSnap.data() } as Program;
                setProgram(programData);

                if (configSnap.exists()) {
                    setProgramConfig(configSnap.data() as ProgramConfig);
                } else {
                     setProgramConfig({ fields: {} });
                }

                setStatus('form');
            } catch (error) {
                console.error("Error fetching program:", error);
                setStatus('not_found');
            }
        }
        fetchProgramData();
    }, [firestore, qrSlug]);
    
     const onSubmit = async (values: z.infer<ReturnType<typeof createFormSchema>>) => {
        if (!firestore || !program) return;
        setStatus('submitting');
        setError(null);
        
        try {
            const location = await getCurrentPosition();
            const result = await createCheckIn(firestore, program.id, values, location);

            if (result.status === 'success') {
                setStatus('success');
                if (program.redirectUrl) {
                    setTimeout(() => { window.location.href = program.redirectUrl!; }, 2000);
                }
            } else {
                let title = 'Check-in Gagal';
                if (result.status === 'too_early') title = 'Check-in Belum Dibuka';
                if (result.status === 'too_late') title = 'Check-in Telah Ditutup';
                setError({ title, message: result.message });
                setStatus('error');
            }
        } catch (err: any) {
            console.error("Error submitting attendance:", err);
            setError({ title: 'Ralat', message: err.message || 'Gagal merekodkan kehadiran. Sila cuba lagi.' });
            setStatus('error');
        }
    };

    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
                        <Card className="w-full max-w-lg">
                            <CardHeader><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
                            <CardContent className="space-y-4">{[...Array(3)].map((_, i) => (<div key={i} className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>))}</CardContent>
                            <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                        </Card>
                    </div>
                );
            case 'not_found':
                return (
                    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
                        <Card className="w-full max-w-lg text-center">
                            <CardHeader><AlertCircle className="h-16 w-16 text-destructive mx-auto" /><CardTitle className="mt-4">Borang Tidak Dijumpai</CardTitle></CardHeader>
                            <CardContent><p>Kod QR ini tidak sah atau program telah tamat. Sila dapatkan kod QR yang sah daripada penganjur.</p></CardContent>
                        </Card>
                    </div>
                );
            case 'success':
                return (
                    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
                        <Card className="w-full max-w-lg text-center">
                            <CardHeader><CheckCircle className="h-16 w-16 text-green-500 mx-auto" /><CardTitle className="mt-4">Terima Kasih!</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-lg">Kehadiran anda telah berjaya direkodkan.</p>
                                {program?.redirectUrl && <p className="text-sm text-muted-foreground mt-4">Anda akan dialihkan sebentar lagi...</p>}
                            </CardContent>
                        </Card>
                    </div>
                );
            case 'error':
                return (
                  <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
                    <Card className="w-full max-w-lg text-center">
                        <CardHeader><AlertCircle className="h-16 w-16 text-destructive mx-auto" /><CardTitle className="mt-4">{error?.title}</CardTitle></CardHeader>
                        <CardContent>
                            <p>{error?.message}</p>
                            <Button onClick={() => setStatus('form')} className="mt-6">Cuba Lagi</Button>
                        </CardContent>
                    </Card>
                  </div>
                );
            case 'form':
            case 'submitting':
                return (
                    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
                        <Card className="w-full max-w-lg">
                            <CardHeader>
                                <CardTitle className="font-headline text-2xl">{program?.title}</CardTitle>
                                <CardDescription>{programConfig?.copywriting || 'Sila isi borang di bawah untuk merekodkan kehadiran anda.'}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                        <FormField control={form.control} name="studentName" render={({ field }) => (<FormItem><FormLabel>Nama Penuh</FormLabel><FormControl><Input placeholder="Nama Penuh Anda" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                        {programConfig?.fields.requireStudentId && (<FormField control={form.control} name="studentId" render={({ field }) => (<FormItem><FormLabel>ID Pelajar (No. Matrik)</FormLabel><FormControl><Input placeholder="ID Pelajar" {...field} /></FormControl><FormMessage /></FormItem>)}/>)}
                                        <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Emel</FormLabel><FormControl><Input type="email" placeholder="alamat@emel.com" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                        {programConfig?.fields.requirePhone && (<FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Nombor Telefon</FormLabel><FormControl><Input type="tel" placeholder="012-3456789" {...field} /></FormControl><FormMessage /></FormItem>)}/>)}
                                        {programConfig?.fields.requireClass && (<FormField control={form.control} name="classGroup" render={({ field }) => (<FormItem><FormLabel>Kelas</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Pilih kelas anda" /></SelectTrigger></FormControl><SelectContent>{classOptions.map((option) => (<SelectItem key={option} value={option}>{option}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>)}
                                        {programConfig?.fields.customInput1Enabled && (<FormField control={form.control} name="customInput1" render={({ field }) => (<FormItem><FormLabel>{programConfig.fields.customInput1Label || 'Custom Field 1'}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>)}
                                        {programConfig?.fields.customInput2Enabled && (<FormField control={form.control} name="customInput2" render={({ field }) => (<FormItem><FormLabel>{programConfig.fields.customInput2Label || 'Custom Field 2'}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>)}
                                        <Button type="submit" className="w-full" disabled={status === 'submitting'}>{status === 'submitting' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Hantar</Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    </div>
                );
        }
    };
    
    return renderContent();
}
