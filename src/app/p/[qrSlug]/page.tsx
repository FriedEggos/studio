'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

type PageStatus = 'loading' | 'not_found' | 'form' | 'success';

const classOptions = [
    "DIT1A", "DIT1C", "DIT2A", "DIT2B", "DIT2C", "DIT2D", "DIT3A", "DIT3C",
    "DIT4A", "DIT4B", "DIT4C", "DIT4D", "DIT5A", "DIT5C", "LAIN-LAIN"
];

export default function PublicAttendancePage({ params }: { params: { qrSlug: string } }) {
    const { qrSlug } = params;
    const firestore = useFirestore();
    const router = useRouter();

    const [status, setStatus] = useState<PageStatus>('loading');
    const [program, setProgram] = useState<Program | null>(null);
    const [programConfig, setProgramConfig] = useState<ProgramConfig | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // This needs to be a function that returns a schema, because it depends on programConfig state
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
        // Re-initialize the form resolver when the config is loaded
        if (programConfig) {
            form.reset(undefined, {
                keepValues: true,
            });
        }
    }, [programConfig, form]);


    useEffect(() => {
        async function fetchProgramData() {
            if (!firestore || !qrSlug) return;
            try {
                // 1. Resolve slug to programId via the qrSlugs collection
                const slugDocRef = doc(firestore, 'qrSlugs', qrSlug);
                const slugSnap = await getDoc(slugDocRef);

                if (!slugSnap.exists()) {
                    setStatus('not_found');
                    return;
                }
                const { programId } = slugSnap.data();

                // 2. Fetch program and its config using the resolved programId
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
                    const configData = configSnap.data() as ProgramConfig;
                    setProgramConfig(configData);
                } else {
                     setProgramConfig({ fields: {} }); // default empty config
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
        setIsSubmitting(true);
        try {
            // Use the student's email as the document ID to prevent duplicate submissions.
            // This ensures one attendance record per email per program.
            const docId = values.email.toLowerCase();
            const attendanceDocRef = doc(firestore, `programs/${program.id}/attendances`, docId);
            
            await setDoc(attendanceDocRef, {
                ...values,
                programId: program.id,
                createdAt: serverTimestamp(),
                userAgent: navigator.userAgent,
            }, { merge: true }); // Use merge:true to create or update.

            setStatus('success');

            if (program.redirectUrl) {
                // Use timeout to allow user to see success message before redirect
                setTimeout(() => {
                    window.location.href = program.redirectUrl!;
                }, 2000);
            }

        } catch (error) {
            console.error("Error submitting attendance:", error);
            alert("Gagal merekodkan kehadiran. Sila cuba lagi.");
            setIsSubmitting(false);
        }
    };


    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
                <Card className="w-full max-w-lg">
                    <CardHeader>
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ))}
                    </CardContent>
                    <CardFooter>
                        <Skeleton className="h-10 w-full" />
                    </CardFooter>
                </Card>
            </div>
        );
    }
    
    if (status === 'not_found') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
                 <Card className="w-full max-w-lg text-center">
                    <CardHeader>
                        <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
                        <CardTitle className="mt-4">Borang Tidak Dijumpai</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Kod QR ini tidak sah atau program telah tamat. Sila dapatkan kod QR yang sah daripada penganjur.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (status === 'success') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
                 <Card className="w-full max-w-lg text-center">
                    <CardHeader>
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                        <CardTitle className="mt-4">Terima Kasih!</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg">Kehadiran anda telah berjaya direkodkan.</p>
                        {program?.redirectUrl && <p className="text-sm text-muted-foreground mt-4">Anda akan dialihkan sebentar lagi...</p>}
                    </CardContent>
                </Card>
            </div>
        )
    }


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
                            <FormField control={form.control} name="studentName" render={({ field }) => (
                                <FormItem><FormLabel>Nama Penuh</FormLabel><FormControl><Input placeholder="Nama Penuh Anda" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            
                            {programConfig?.fields.requireStudentId && (
                                <FormField control={form.control} name="studentId" render={({ field }) => (
                                    <FormItem><FormLabel>ID Pelajar (No. Matrik)</FormLabel><FormControl><Input placeholder="ID Pelajar" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            )}
                            
                            {/* Email is always required for linking attendance to student account */}
                            <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>Emel</FormLabel><FormControl><Input type="email" placeholder="alamat@emel.com" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            
                            {programConfig?.fields.requirePhone && (
                                <FormField control={form.control} name="phone" render={({ field }) => (
                                    <FormItem><FormLabel>Nombor Telefon</FormLabel><FormControl><Input type="tel" placeholder="012-3456789" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            )}

                            {programConfig?.fields.requireClass && (
                                <FormField
                                    control={form.control}
                                    name="classGroup"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Kelas</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Pilih kelas anda" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {classOptions.map((option) => (
                                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            {programConfig?.fields.customInput1Enabled && (
                                <FormField control={form.control} name="customInput1" render={({ field }) => (
                                    <FormItem><FormLabel>{programConfig.fields.customInput1Label || 'Custom Field 1'}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            )}

                            {programConfig?.fields.customInput2Enabled && (
                                <FormField control={form.control} name="customInput2" render={({ field }) => (
                                    <FormItem><FormLabel>{programConfig.fields.customInput2Label || 'Custom Field 2'}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            )}

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Hantar
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
