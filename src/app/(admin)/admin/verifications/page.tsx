
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { useFirestore } from "@/firebase";
import { collectionGroup, doc, query, updateDoc, where, orderBy, onSnapshot, limit, startAfter, getDocs, type Query, type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
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
  evidenceUrl?: string;
}

const POSITIONS_PER_PAGE = 20;

export default function VerificationsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [positionToReject, setPositionToReject] = useState<Position | null>(null);
  const [rejectionRemark, setRejectionRemark] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  
  // Data State
  const [pendingPositions, setPendingPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [pageCursors, setPageCursors] = useState<(QueryDocumentSnapshot | null)[]>([null]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    if (!firestore) return;

    setIsLoading(true);

    const baseQuery = query(
        collectionGroup(firestore, 'positions'),
        where('verificationStatus', '==', 'pending'),
        orderBy('createdAt', 'desc')
    );
    
    let q: Query<DocumentData> = baseQuery;
    
    const cursor = pageCursors[page - 1];
    if (cursor) {
      q = query(q, startAfter(cursor));
    }
    
    q = query(q, limit(POSITIONS_PER_PAGE + 1));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPositions = snapshot.docs.slice(0, POSITIONS_PER_PAGE).map(doc => ({ id: doc.id, ...doc.data() } as Position));
      setPendingPositions(fetchedPositions);
      
      const hasMore = snapshot.docs.length > POSITIONS_PER_PAGE;
      setHasNextPage(hasMore);

      if (hasMore) {
        const lastVisibleDoc = snapshot.docs[POSITIONS_PER_PAGE - 1];
        if (page >= pageCursors.length) {
            setPageCursors(prev => [...prev, lastVisibleDoc]);
        }
      }
      setIsLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching pending verifications:", err);
      setError(err);
      toast({ variant: "destructive", title: "Failed to load verifications." });
      setIsLoading(false);
    });

    // Also get total count for display
    getDocs(baseQuery).then(totalSnapshot => {
        setTotalRecords(totalSnapshot.size);
    });
    
    return () => unsubscribe();
  }, [firestore, toast, page, pageCursors]);


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
  
  const handlePageChange = (direction: 'next' | 'prev') => {
    if (direction === 'next' && hasNextPage) {
        setPage(p => p + 1);
    } else if (direction === 'prev' && page > 1) {
        setPage(p => p - 1);
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
                  <TableHead>Position</TableHead>
                  <TableHead>Proof</TableHead>
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
                      <TableCell><Skeleton className="h-9 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell className="text-right space-x-2"><Skeleton className="h-8 w-8 inline-block" /><Skeleton className="h-8 w-8 inline-block" /></TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-destructive">
                      Error loading verifications. Please try again.
                    </TableCell>
                  </TableRow>
                ) : pendingPositions && pendingPositions.length > 0 ? (
                  pendingPositions.map((pos, index) => (
                    <TableRow key={pos.id}>
                      <TableCell>{((page - 1) * POSITIONS_PER_PAGE) + index + 1}</TableCell>
                      <TableCell className="font-medium">{pos.userName}</TableCell>
                      <TableCell>{pos.programName}</TableCell>
                      <TableCell>
                        {pos.positionName}
                        {pos.positionName === "AJK Lain-Lain" && pos.customPositionDetail && (
                          <span className="text-muted-foreground ml-2">({pos.customPositionDetail})</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {pos.evidenceUrl ? (
                            <Button variant="outline" size="sm" onClick={() => setPreviewImageUrl(pos.evidenceUrl!)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                            </Button>
                        ) : (
                            'N/A'
                        )}
                      </TableCell>
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
                    <TableCell colSpan={7} className="h-24 text-center">
                      No pending verifications found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t pt-6">
            <span className="text-sm text-muted-foreground">
                Page {page}
            </span>
            <div className="flex items-center gap-2">
                <Button onClick={() => handlePageChange('prev')} disabled={page <= 1 || isLoading} variant="outline" size="sm">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
                </Button>
                <Button onClick={() => handlePageChange('next')} disabled={!hasNextPage || isLoading} variant="outline" size="sm">
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
            </div>
          </CardFooter>
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
      
      <Dialog open={!!previewImageUrl} onOpenChange={(open) => !open && setPreviewImageUrl(null)}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Proof of Contribution</DialogTitle>
            </DialogHeader>
            <div className="py-4 -mx-6 px-6 max-h-[80vh] overflow-y-auto">
                {previewImageUrl && <img src={previewImageUrl} alt="Proof of contribution" className="w-full h-auto rounded-md object-contain" />}
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
