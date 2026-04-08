
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
import { Button } from "@/components/ui/button";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collectionGroup, doc, query, updateDoc, where, orderBy } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2 } from "lucide-react";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Position {
  id: string;
  userId: string;
  userName: string;
  positionName: string;
  customPositionDetail?: string;
  programName: string;
  peringkat?: string;
  semester?: number;
  className?: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  createdAt: { toDate: () => Date };
}

export default function VerificationsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [positionToReject, setPositionToReject] = useState<Position | null>(null);
  const [rejectionRemark, setRejectionRemark] = useState("");

  const pendingQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collectionGroup(firestore, 'positions'),
      where('verificationStatus', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore]);

  const { data: pendingPositions, isLoading, error } = useCollection<Position>(pendingQuery);

  const handleVerification = async (position: Position, newStatus: 'approved' | 'rejected', remark?: string) => {
    if (!firestore) return;
    
    if (!position.userId || !position.id) {
        console.error("Invalid position data received:", position);
        toast({
            variant: "destructive",
            title: "Invalid Data",
            description: "Cannot process verification due to missing user or position ID.",
        });
        return;
    }

    setIsSubmitting(true);
    const positionDocRef = doc(firestore, `users/${position.userId}/positions`, position.id);
    
    try {
      const updateData: { verificationStatus: string; rejectionRemark?: string } = {
        verificationStatus: newStatus,
      };
      if (newStatus === 'rejected') {
        updateData.rejectionRemark = remark || "No remark provided.";
      }
      
      await updateDoc(positionDocRef, updateData);
      toast({
        title: `Position ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
        description: `The position for ${position.userName} has been updated.`,
      });
    } catch (err: any) {
      console.error('Verification update failed:', err);
      let description = 'Could not update the position status.';
      if (err.code === 'not-found') {
        description = 'The position may have been deleted or modified. The list will refresh.';
      }
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: description,
      });
    } finally {
      setIsSubmitting(false);
      setPositionToReject(null);
      setRejectionRemark("");
    }
  };

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          Verification
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
            <CardDescription>
              Review and approve or reject position claims submitted by students.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-6" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell className="text-right space-x-2"><Skeleton className="h-8 w-8 inline-block" /><Skeleton className="h-8 w-8 inline-block" /></TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-destructive">
                      Error loading verifications. Please try again.
                    </TableCell>
                  </TableRow>
                ) : pendingPositions && pendingPositions.length > 0 ? (
                  pendingPositions.map((pos, index) => (
                    <TableRow key={pos.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{pos.userName}</TableCell>
                      <TableCell>{pos.programName}</TableCell>
                      <TableCell>{pos.peringkat || 'N/A'}</TableCell>
                      <TableCell>
                        {pos.positionName}
                        {pos.positionName === "AJK Lain-Lain" && pos.customPositionDetail && (
                          <span className="text-muted-foreground ml-2">({pos.customPositionDetail})</span>
                        )}
                      </TableCell>
                      <TableCell>{pos.semester || 'N/A'}</TableCell>
                      <TableCell>{pos.className || 'N/A'}</TableCell>
                      <TableCell>
                        {pos.createdAt ? format(pos.createdAt.toDate(), 'dd/MM/yyyy') : ''}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                          onClick={() => handleVerification(pos, 'approved')}
                          disabled={isSubmitting}
                        >
                          <Check className="h-4 w-4" />
                          <span className="sr-only">Approve</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          onClick={() => setPositionToReject(pos)}
                          disabled={isSubmitting}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Reject</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      No pending verifications found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!positionToReject} onOpenChange={(open) => !open && setPositionToReject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Application</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting the application for "{positionToReject?.programName}" by {positionToReject?.userName}. This remark will be visible to the student.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-remark" className="mb-2 block">Rejection Remark</Label>
            <Textarea
              id="rejection-remark"
              placeholder="e.g., The program name is incorrect, please specify the year..."
              value={rejectionRemark}
              onChange={(e) => setRejectionRemark(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPositionToReject(null); setRejectionRemark(""); }} disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (positionToReject) {
                  handleVerification(positionToReject, 'rejected', rejectionRemark);
                }
              }}
              disabled={isSubmitting || !rejectionRemark}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
