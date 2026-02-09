
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
import { ArrowUpRight, CheckCircle, Clock, Users, List, Eye, MoreHorizontal, Check, XIcon } from "lucide-react";
import Link from "next/link";
import { pendingVerifications as initialPendingVerifications, allProgramsAdmin as initialAllProgramsAdmin } from "@/lib/data";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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


type ProgramStatus = "Upcoming" | "Ongoing" | "Completed";

type Program = {
    id: string;
    name: string;
    participants: number;
    status: ProgramStatus;
};

type PendingVerification = {
    id: string;
    studentName: string;
    programName: string;
    submissionDate: string;
    imageUrl: string;
};


export default function AdminDashboard() {
  const [allProgramsAdmin, setAllProgramsAdmin] = useState<Program[]>(
    initialAllProgramsAdmin.map(p => ({...p, status: p.status as ProgramStatus}))
  );

  const [pending, setPending] = useState<PendingVerification[]>(initialPendingVerifications);
  const [reviewItem, setReviewItem] = useState<PendingVerification | null>(null);
  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject' | null;
  }>({ isOpen: false, action: null });
  
  const { toast } = useToast();

  const handleStatusChange = (programId: string, newStatus: ProgramStatus) => {
      setAllProgramsAdmin(currentPrograms => 
          currentPrograms.map(p => 
              p.id === programId ? { ...p, status: newStatus } : p
          )
      );
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

  const handleConfirmAction = () => {
    if (!reviewItem || !confirmationState.action) return;

    // In a real app, you'd update your database here.
    // For now, we filter the item out of the local state.
    setPending(current => current.filter(p => p.id !== reviewItem.id));
    
    toast({
        title: `Submission ${confirmationState.action === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `The evidence from ${reviewItem.studentName} for "${reviewItem.programName}" has been processed.`,
    });

    handleCloseModals();
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
            Admin Dashboard
          </h1>
          <Button asChild>
            <Link href="/admin/programs/create">Create New Program</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Programs</CardTitle>
              <List className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">+2 since last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Participants
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+2,350</div>
              <p className="text-xs text-muted-foreground">
                +180.1% since last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Verifications
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pending.length}</div>
              <p className="text-xs text-muted-foreground">
                Needs immediate review
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Certificates Generated
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+573</div>
              <p className="text-xs text-muted-foreground">
                +201 since last week
              </p>
            </CardContent>
          </Card>
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
                    <TableHead>Submission Date</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.studentName}
                      </TableCell>
                      <TableCell>{item.programName}</TableCell>
                      <TableCell>{item.submissionDate}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => handleOpenReviewModal(item)}>
                          <Eye className="mr-2 h-4 w-4" /> Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="col-span-4 lg:col-span-3">
            <CardHeader>
              <CardTitle className="font-headline">Program List</CardTitle>
              <CardDescription>
                Summary of all past and future programs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allProgramsAdmin.map((program) => (
                  <div key={program.id} className="flex items-center">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {program.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {program.participants} participants
                      </p>
                    </div>
                    <div className="ml-auto font-medium flex items-center gap-2">
                      <Badge
                        variant={
                          program.status === "Completed"
                            ? "default"
                            : program.status === "Ongoing"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {program.status}
                      </Badge>
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleStatusChange(program.id, 'Upcoming')}>Upcoming</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(program.id, 'Ongoing')}>Ongoing</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(program.id, 'Completed')}>Completed</DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!reviewItem} onOpenChange={(isOpen) => !isOpen && handleCloseModals()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-headline">{reviewItem?.programName}</DialogTitle>
            <DialogDescription>
              Submitted by: {reviewItem?.studentName} on {reviewItem?.submissionDate}
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 aspect-video relative">
            {reviewItem?.imageUrl && (
              <Image
                src={reviewItem.imageUrl}
                alt={`Evidence for ${reviewItem.programName}`}
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
