
'use client';

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
import { Skeleton } from "@/components/ui/skeleton";
import { useUser, useFirestore } from "@/firebase";
import { collectionGroup, query, where, getDocs, collection } from "firebase/firestore";
import { useEffect, useState } from "react";
import { format } from "date-fns";

interface Attendance {
    id: string;
    programId: string;
    createdAt: { toDate: () => Date };
}

interface Program {
    id: string;
    title: string;
}

export default function StudentDashboard() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [attendedPrograms, setAttendedPrograms] = useState<(Attendance & { programTitle?: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAttendanceHistory = async () => {
            if (!user || !firestore || !user.email) return;

            setIsLoading(true);
            try {
                const attendanceQuery = query(
                    collectionGroup(firestore, 'attendances'),
                    where('email', '==', user.email)
                );

                const attendanceSnapshot = await getDocs(attendanceQuery);
                const attendances = attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Attendance[];
                
                // Sort on the client to avoid needing a composite index
                attendances.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(0);
                    const dateB = b.createdAt?.toDate?.() || new Date(0);
                    return dateB.getTime() - dateA.getTime();
                });


                // Fetch program titles for each attendance
                const programIds = [...new Set(attendances.map(a => a.programId))];
                if (programIds.length > 0) {
                    const programsQuery = query(collection(firestore, 'programs'), where('__name__', 'in', programIds));
                    const programsSnapshot = await getDocs(programsQuery);
                    const programsMap = new Map<string, string>();
                    programsSnapshot.forEach(doc => {
                        programsMap.set(doc.id, (doc.data() as Program).title);
                    });

                    const populatedAttendances = attendances.map(att => ({
                        ...att,
                        programTitle: programsMap.get(att.programId) || 'Unknown Program'
                    }));
                    setAttendedPrograms(populatedAttendances);
                } else {
                    setAttendedPrograms([]);
                }

            } catch (error) {
                console.error("Error fetching attendance history:", error);
                // You might want to show a toast message here
            } finally {
                setIsLoading(false);
            }
        };

        if (user) {
            fetchAttendanceHistory();
        } else if (!isUserLoading) {
            setIsLoading(false);
        }
    }, [user, firestore, isUserLoading]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                        Student Dashboard
                    </h1>
                    <p className="text-muted-foreground">
                        Welcome! Here is a summary of your activities.
                    </p>
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Attendance History</CardTitle>
                    <CardDescription>
                        A record of all programs you have attended.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Program Title</TableHead>
                                <TableHead>Date Attended</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    </TableRow>
                                ))
                            ) : attendedPrograms.length > 0 ? (
                                attendedPrograms.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.programTitle}</TableCell>
                                        <TableCell>{format(item.createdAt.toDate(), 'PPP p')}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="h-24 text-center">
                                        You have not attended any programs yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
