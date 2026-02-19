
'use client';

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
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Users, List, Eye, Check, XIcon, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, collectionGroup, query, where, doc, updateDoc, setDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { isFuture, isPast, parseISO } from 'date-fns';

type Program = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
};

type PendingVerification = {
    id: string;
    user_id: string;
    studentName: string;
    programname: string;
    image_url: string;
};


export default function AdminDashboard() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const [isSeeding, setIsSeeding] = useState(false);

  const programsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'programs');
  }, [firestore]);
  const { data: programs, isLoading: isLoadingPrograms } = useCollection<Program>(programsQuery);

  // Data fetching from firestore for other stats
  const pendingQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collectionGroup(firestore, 'activity_evidence'), where('status', '==', 'pending'));
  }, [firestore]);
  const { data: pending, isLoading: isLoadingPending } = useCollection<PendingVerification>(pendingQuery);

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collectionGroup(firestore, 'attendance');
  }, [firestore]);
  const { data: attendance, isLoading: isLoadingAttendance } = useCollection(attendanceQuery);

  const certificatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collectionGroup(firestore, 'certificates');
  }, [firestore]);
  const { data: certificates, isLoading: isLoadingCertificates } = useCollection(certificatesQuery);

  // Modal and confirmation state
  const [reviewItem, setReviewItem] = useState<PendingVerification | null>(null);
  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject' | null;
  }>({ isOpen: false, action: null });
  
  const getProgramStatus = (startDateString: string, endDateString: string): { text: 'Upcoming' | 'Ongoing' | 'Completed'; variant: "secondary" | "default" | "outline" } => {
    try {
        const start = parseISO(startDateString);
        const end = parseISO(endDateString);
        end.setHours(23, 59, 59, 999);

        const now = new Date();

        if (isPast(end)) {
            return { text: 'Completed', variant: 'outline' };
        }
        if (isFuture(start)) {
            return { text: 'Upcoming', variant: 'secondary' };
        }
        return { text: 'Ongoing', variant: 'default' };
    } catch(e) {
        console.error("Invalid date format for program", e);
        return { text: 'Upcoming', variant: 'secondary'}; // default status
    }
  };
  
  const handleOpenReviewModal = (item: PendingVerification) => {
    setReviewItem(item);
  };

  const handleCloseModals = () => {
    setReviewItem(null);
    setConfirmationState({ isOpen: false, action: null });
  };

  const handleOpenConfirmation = (action: 'approve' | 'reject') => {
    setConfirmationState({ isOpen: true, action });
  };

  const handleConfirmAction = async () => {
    if (!reviewItem || !confirmationState.action || !firestore) return;

    const newStatus = confirmationState.action === 'approve' ? 'approved' : 'rejected';
    const evidenceDocRef = doc(firestore, `users/${reviewItem.user_id}/activity_evidence/${reviewItem.id}`);

    try {
      await updateDoc(evidenceDocRef, {
        status: newStatus,
      });

      toast({
        title: `Submission ${confirmationState.action === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `The evidence from ${reviewItem.studentName} for "${reviewItem.programname}" has been processed.`,
      });
    } catch (error) {
      console.error("Error updating verification status:", error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'An error occurred while processing the submission.',
      });
    }
    
    handleCloseModals();
  };

  const handleSeedDatabase = async () => {
    if (!firestore || !user) {
        toast({
            variant: "destructive",
            title: "Cannot Seed Data",
            description: "User not authenticated or Firestore is unavailable."
        });
        return;
    }
    setIsSeeding(true);

    const dummyPrograms = [
        {
            id: 'dummy-prog-1',
            name: "UI/UX Design Workshop",
            briefDescription: "Learn the fundamentals of UI/UX design with industry experts.",
            description: "A comprehensive workshop covering user research, wireframing, prototyping, and user testing. Perfect for beginners and those looking to refine their skills.",
            startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            venue: "Main Hall, JTMK",
            organizerUnit: "Jabatan Teknologi Maklumat & Komunikasi",
            status: "active",
            adminId: user.uid,
            imageUrl: "https://images.unsplash.com/photo-1581091226033-d5c48150dbaa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw5fHxjb2RpbmclMjB3b3Jrc2hvcHxlbnwwfHx8fDE3Njg3OTY0Mjd8MA&ixlib=rb-4.1.0&q=80&w=1080",
            qrCodeUrl: "https://images.unsplash.com/photo-1629128625414-374a9e16d56a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw4fHxxciUyMGNvZGV8ZW58MHx8fHwxNzY4NzU5ODAxfDA&ixlib=rb-4.1.0&q=80&w=1080",
            createdAt: new Date().toISOString(),
        },
        {
            id: 'dummy-prog-2',
            name: "Cybersecurity Awareness Talk",
            briefDescription: "Stay safe online! A talk on the latest cybersecurity threats and how to protect yourself.",
            description: "This talk will cover phishing, malware, social engineering, and best practices for personal and organizational security. Q&A session with a security professional.",
            startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            venue: "Auditorium, PSIS",
            organizerUnit: "MPP PSIS",
            status: "active",
            adminId: user.uid,
            imageUrl: "https://images.unsplash.com/photo-1719255417989-b6858e87359e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxMHx8Y3liZXJzZWN1cml0eSUyMHNlbWluYXJ8ZW58MHx8fHwxNzY4Nzk2NDI3fDA&ixlib=rb-4.1.0&q=80&w=1080",
            qrCodeUrl: "https://images.unsplash.com/photo-1629128625414-374a9e16d56a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw4fHxxciUyMGNvZGV8ZW58MHx8fHwxNzY4NzU5ODAxfDA&ixlib=rb-4.1.0&q=80&w=1080",
            createdAt: new Date().toISOString(),
        },
        {
            id: 'dummy-prog-3',
            name: "Agile & Scrum Fundamentals",
            briefDescription: "An introduction to Agile methodologies and the Scrum framework for project management.",
            description: "Learn how to manage projects effectively with Agile and Scrum. This session will cover sprints, stand-ups, retrospectives, and the roles within a Scrum team.",
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            venue: "Bilik Kuliah 4, JTMK",
            organizerUnit: "Jabatan Perdagangan",
            status: "closed",
            adminId: user.uid,
            imageUrl: "https://images.unsplash.com/photo-1550177977-ad69e8f3cae0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw2fHxuZXR3b3JraW5nJTIwZXZlbnR8ZW58MHx8fHwxNzY4NzI3MTc1fDA&ixlib=rb-4.1.0&q=80&w=1080",
            qrCodeUrl: "https://images.unsplash.com/photo-1629128625414-374a9e16d56a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw4fHxxciUyMGNvZGV8ZW58MHx8fHwxNzY4NzU5ODAxfDA&ixlib=rb-4.1.0&q=80&w=1080",
            createdAt: new Date().toISOString(),
        }
    ];

    try {
        const promises = dummyPrograms.map(program => {
            const programRef = doc(firestore, "programs", program.id);
            return setDoc(programRef, program);
        });

        await Promise.all(promises);

        toast({
            title: "Database Seeded!",
            description: `${dummyPrograms.length} programs have been added to Firestore.`
        });
    } catch(error) {
        console.error("Error seeding database: ", error);
        toast({
            variant: "destructive",
            title: "Seeding Failed",
            description: "Could not add dummy data to the database. Check console for errors.",
        });
    } finally {
        setIsSeeding(false);
    }
  };


  const StatCard = ({ title, icon: Icon, value, isLoading, description }: { title: string, icon: React.ElementType, value: number, isLoading: boolean, description: string }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
            Admin Dashboard
          </h1>
          <div className="flex items-center gap-2">
            <Button onClick={handleSeedDatabase} variant="outline" disabled={isSeeding}>
              {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSeeding ? 'Seeding...' : 'Seed Database'}
            </Button>
            <Button asChild>
              <Link href="/admin/programs/create">Create New Program</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <StatCard
            title="Total Programs"
            icon={List}
            value={programs?.length ?? 0}
            isLoading={isLoadingPrograms}
            description="Total programs in Firestore."
          />
           <StatCard
            title="Total Attendances"
            icon={Users}
            value={attendance?.length ?? 0}
            isLoading={isLoadingAttendance}
            description="Total QR scans across all programs."
          />
          <StatCard
            title="Pending Verifications"
            icon={Clock}
            value={pending?.length ?? 0}
            isLoading={isLoadingPending}
            description="Needs immediate review."
          />
          <StatCard
            title="Certificates Generated"
            icon={CheckCircle}
            value={certificates?.length ?? 0}
            isLoading={isLoadingCertificates}
            description="Total certificates issued."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle className="font-headline">Pending Verifications</CardTitle>
              <CardDescription>
                Verify the proof of participation uploaded by students.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingPending ? (
                     [...Array(3)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : pending && pending.length > 0 ? (
                    pending.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.studentName}
                        </TableCell>
                        <TableCell>{item.programname}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => handleOpenReviewModal(item)}>
                            <Eye className="mr-2 h-4 w-4" /> Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        No pending verifications.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="col-span-4 lg:col-span-3">
            <CardHeader>
              <CardTitle className="font-headline">Program List</CardTitle>
              <CardDescription>
                Summary of all programs from the database.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoadingPrograms ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center">
                      <div className="space-y-1">
                         <Skeleton className="h-5 w-40" />
                      </div>
                      <div className="ml-auto font-medium flex items-center gap-2">
                        <Skeleton className="h-5 w-20" />
                      </div>
                    </div>
                  ))
                ) : programs && programs.length > 0 ? (
                  programs.map((program) => {
                    const status = getProgramStatus(program.startDate, program.endDate);
                    return (
                      <div key={program.id} className="flex items-center">
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {program.name}
                          </p>
                        </div>
                        <div className="ml-auto font-medium flex items-center gap-2">
                          <Badge variant={status.variant}>
                            {status.text}
                          </Badge>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground text-center h-24 flex items-center justify-center">
                    No programs found in the database.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!reviewItem} onOpenChange={(isOpen) => !isOpen && handleCloseModals()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-headline">{reviewItem?.programname}</DialogTitle>
            <DialogDescription>
              Submitted by: {reviewItem?.studentName}
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 aspect-video relative">
            {reviewItem?.image_url && (
              <Image
                src={reviewItem.image_url}
                alt={`Evidence for ${reviewItem.programname}`}
                fill
                className="rounded-md object-contain"
              />
            )}
          </div>
          <DialogFooter className="sm:justify-between flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCloseModals}>Close</Button>
            <div className="flex justify-end gap-2">
              <Button variant="destructive" onClick={() => handleOpenConfirmation('reject')}>
                <XIcon className="mr-2 h-4 w-4" /> Reject
              </Button>
              <Button onClick={() => handleOpenConfirmation('approve')}>
                <Check className="mr-2 h-4 w-4" /> Approve
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={confirmationState.isOpen} onOpenChange={(open) => !open && setConfirmationState({ isOpen: false, action: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will {confirmationState.action} the submission for this program. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmAction} 
              className={confirmationState.action === 'reject' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              Yes, {confirmationState.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
