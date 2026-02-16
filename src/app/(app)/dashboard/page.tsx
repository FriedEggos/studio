
'use client';

import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
  DialogDescription
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowRight, Calendar, X, Camera, RefreshCw, Upload, Loader2 } from "lucide-react";
import { programs as allPrograms } from "@/lib/data";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isFuture, isPast, parseISO, format } from 'date-fns';
import { useUser, useFirestore, useStorage, useCollection, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, serverTimestamp, query } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";


interface Program {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    description: string;
    imageId: string;
}

export default function StudentDashboard() {
  const [myProgramIds, setMyProgramIds] = useState<Set<string>>(new Set());
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const participationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/participations`));
  }, [user, firestore]);

  const { data: participations } = useCollection(participationsQuery);

  const [submittedProgramIds, setSubmittedProgramIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (participations) {
      setSubmittedProgramIds(new Set(participations.map(p => p.programId)));
    }
  }, [participations]);
  
  useEffect(() => {
    if (!isEvidenceModalOpen) return;

    setCapturedImage(null);
    setHasCameraPermission(null);

    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true});
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };

    getCameraPermission();
    
    return () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    }
  }, [isEvidenceModalOpen, toast]);

  const getProgramStatus = (startDateString: string, endDateString: string): { text: 'Upcoming' | 'Ongoing' | 'Completed'; variant: 'secondary' | 'default' | 'outline' } => {
    const start = parseISO(startDateString);
    const end = parseISO(endDateString);
    // Set end date to the end of the day to make it inclusive
    end.setHours(23, 59, 59, 999);

    const now = new Date();

    if (isPast(end)) {
        return { text: 'Completed', variant: 'outline' };
    }
    if (isFuture(start)) {
        return { text: 'Upcoming', variant: 'secondary' };
    }
    return { text: 'Ongoing', variant: 'default' };
  };

  const handleOpenProgramModal = (program: Program) => {
    setSelectedProgram(program);
  };

  const handleCloseProgramModal = () => {
    setSelectedProgram(null);
  };

  const handleJoinProgram = () => {
    if (!selectedProgram) return;

    setMyProgramIds(prev => new Set(prev).add(selectedProgram.id));
    
    toast({
      title: "Program Joined!",
      description: `You have joined "${selectedProgram.name}". It is now in 'My Programs'.`,
    });

    handleCloseProgramModal();
  };

  const handleLeaveProgram = () => {
    if (!selectedProgram) return;

    setMyProgramIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedProgram.id);
        return newSet;
    });
    
    toast({
        title: "Program Left",
        description: `You have left "${selectedProgram.name}".`,
    });

    handleCloseProgramModal();
    setIsLeaveConfirmOpen(false);
  };
  
  const handleOpenImageModal = () => {
    if (selectedProgram) {
      setIsImageModalOpen(true);
    }
  };
  
  const handleCloseImageModal = () => {
    setIsImageModalOpen(false);
  };

  const handleOpenEvidenceModal = () => {
    if (selectedProgram) {
        handleCloseProgramModal(); 
        setIsEvidenceModalOpen(true);
    }
  };

  const handleCloseEvidenceModal = () => {
      setIsEvidenceModalOpen(false);
      setCapturedImage(null); 
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
      }
    }
  };

  const handleRetake = () => {
      setCapturedImage(null);
  };
  
  const handleSubmitEvidence = async () => {
    if (!capturedImage || !user || !firestore || !storage || !selectedProgram) return;

    setIsSubmitting(true);

    try {
        const blob = await (await fetch(capturedImage)).blob();

        const storageRef = ref(storage, `evidence/${user.uid}/${selectedProgram.id}/${Date.now()}.jpg`);
        const uploadResult = await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(uploadResult.ref);

        const participationsColRef = collection(firestore, `users/${user.uid}/participations`);
        await addDoc(participationsColRef, {
            userId: user.uid,
            programId: selectedProgram.id,
            programName: selectedProgram.name,
            participationDate: serverTimestamp(),
            activityEvidenceUrl: downloadURL,
            verificationStatus: 'pending',
            badgeIssued: false,
            certificateIssued: false,
        });

        toast({
            title: "Evidence Submitted",
            description: "Your participation proof has been sent for verification.",
        });
        handleCloseEvidenceModal();

    } catch (error) {
        console.error("Error submitting evidence:", error);
        toast({
            variant: "destructive",
            title: "Submission Failed",
            description: "An error occurred while submitting your evidence. Please try again.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const selectedImage = PlaceHolderImages.find(
    (img) => img.id === selectedProgram?.imageId
  );
  
  const selectedProgramStatus = selectedProgram ? getProgramStatus(selectedProgram.startDate, selectedProgram.endDate) : null;
  const isProgramJoined = selectedProgram ? myProgramIds.has(selectedProgram.id) : false;
  const hasSubmittedEvidence = selectedProgram ? submittedProgramIds.has(selectedProgram.id) : false;

  const availablePrograms = allPrograms.filter(program => 
    !myProgramIds.has(program.id) && getProgramStatus(program.startDate, program.endDate).text !== 'Completed'
  );

  const myActivePrograms = allPrograms.filter(program => 
    myProgramIds.has(program.id) && getProgramStatus(program.startDate, program.endDate).text !== 'Completed'
  );


  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
              Student Dashboard
            </h1>
            <p className="text-muted-foreground">
              Check available programs and your participation history.
            </p>
          </div>
        </div>

        <section>
          <h2 className="text-xl font-semibold tracking-tight font-headline mb-4">
            Available Programs
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {availablePrograms.map((program) => {
              const image = PlaceHolderImages.find(
                (img) => img.id === program.imageId
              );
              const status = getProgramStatus(program.startDate, program.endDate);
              return (
                <Card
                  key={program.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
                >
                  {image && (
                    <Image
                      src={image.imageUrl}
                      alt={image.description}
                      width={600}
                      height={400}
                      data-ai-hint={image.imageHint}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <CardHeader>
                    <CardTitle className="font-headline text-lg">
                      {program.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 pt-1">
                      <Calendar className="h-4 w-4" />
                      <span>{format(parseISO(program.startDate), 'd MMM yyyy')} - {format(parseISO(program.endDate), 'd MMM yyyy')}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {program.description}
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-3 pt-4">
                     <Badge variant={status.variant}>{status.text}</Badge>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleOpenProgramModal(program)}
                    >
                      View Details{" "}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight font-headline mb-4">
            My Programs
          </h2>
            {myActivePrograms.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {myActivePrograms.map((program) => {
                  const image = PlaceHolderImages.find(
                    (img) => img.id === program.imageId
                  );
                  const status = getProgramStatus(program.startDate, program.endDate);
                  return (
                    <Card
                      key={program.id}
                      className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
                    >
                      {image && (
                        <Image
                          src={image.imageUrl}
                          alt={image.description}
                          width={600}
                          height={400}
                          data-ai-hint={image.imageHint}
                          className="w-full h-40 object-cover"
                        />
                      )}
                      <CardHeader>
                        <CardTitle className="font-headline text-lg">
                          {program.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 pt-1">
                          <Calendar className="h-4 w-4" />
                          <span>{format(parseISO(program.startDate), 'd MMM yyyy')} - {format(parseISO(program.endDate), 'd MMM yyyy')}</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {program.description}
                        </p>
                      </CardContent>
                      <CardFooter className="flex-col items-start gap-3 pt-4">
                         <Badge variant={status.variant}>{status.text}</Badge>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handleOpenProgramModal(program)}
                        >
                          View Details{" "}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-muted-foreground">You have not joined any programs yet. Join one from the list above!</p>
                    </CardContent>
                </Card>
            )}
        </section>
      </div>

      <Dialog open={!!selectedProgram} onOpenChange={(isOpen) => !isOpen && handleCloseProgramModal()}>
        <DialogContent className="sm:max-w-[425px] md:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center font-headline">
              {selectedProgram?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 px-2 space-y-4">
            {selectedImage && (
              <div className="flex justify-center">
                 <Image
                    src={selectedImage.imageUrl}
                    alt={selectedImage.description}
                    width={500}
                    height={333}
                    data-ai-hint={selectedImage.imageHint}
                    className="rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={handleOpenImageModal}
                  />
              </div>
            )}
            <div className="text-left space-y-2">
                 <h3 className="font-semibold text-lg">Event Details</h3>
                 <p className="text-muted-foreground text-sm">{selectedProgram?.description}</p>
                 <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4"/>
                    {selectedProgram && <span>{format(parseISO(selectedProgram.startDate), 'd MMM yyyy')} - {format(parseISO(selectedProgram.endDate), 'd MMM yyyy')}</span>}
                 </div>
            </div>
          </div>
          <DialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 sm:justify-center">
            {isProgramJoined ? (
              <>
                <Button 
                  size="lg"
                  disabled={selectedProgramStatus?.text !== 'Ongoing' || hasSubmittedEvidence}
                  onClick={handleOpenEvidenceModal}
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Submit Evidence
                </Button>
                {!hasSubmittedEvidence ? (
                   <Button
                      variant="destructive"
                      size="lg"
                      onClick={() => setIsLeaveConfirmOpen(true)}
                    >
                      Leave Program
                    </Button>
                ) : (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    You cannot leave a program after submitting evidence.
                  </p>
                )}
              </>
            ) : (
              <Button 
                size="lg"
                disabled={selectedProgramStatus?.text === 'Completed'}
                onClick={handleJoinProgram}
              >
                Join Program
              </Button>
            )}
          </DialogFooter>
           <DialogClose onClick={handleCloseProgramModal} className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
        </DialogContent>
      </Dialog>

      <Dialog open={isImageModalOpen} onOpenChange={(isOpen) => !isOpen && handleCloseImageModal()}>
        <DialogContent className="p-0 border-0 max-w-4xl bg-transparent shadow-none">
           <DialogHeader className="sr-only">
             <DialogTitle>{selectedProgram?.name || 'Program'} Image</DialogTitle>
             <DialogDescription>Enlarged view of the poster for {selectedProgram?.name}.</DialogDescription>
           </DialogHeader>
           {selectedImage && (
              <Image
                src={selectedImage.imageUrl}
                alt={selectedImage.description}
                width={1200}
                height={800}
                className="rounded-lg object-contain w-full h-full"
              />
            )}
            <DialogClose onClick={handleCloseImageModal} className="absolute -top-2 -right-2 bg-background rounded-full p-1 text-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogClose>
        </DialogContent>
      </Dialog>

      <Dialog open={isEvidenceModalOpen} onOpenChange={(isOpen) => !isOpen && handleCloseEvidenceModal()}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle className="font-headline">Upload Activity Evidence</DialogTitle>
                <DialogDescription>
                    Take a photo as proof of your participation for &quot;{selectedProgram?.name}&quot;.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden border-2 border-dashed relative">
                <video ref={videoRef} className={`w-full h-full object-cover ${capturedImage || hasCameraPermission !== true ? 'hidden' : ''}`} autoPlay muted playsInline />

                {capturedImage && (
                    <Image src={capturedImage} alt="Captured proof" width={640} height={360} className="object-cover absolute inset-0 w-full h-full" />
                )}

                {hasCameraPermission === false && !capturedImage && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 bg-background">
                        <Alert variant="destructive">
                            <AlertTitle>Camera Access Denied</AlertTitle>
                            <AlertDescription>
                                Please enable camera permissions in your browser settings to continue.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}

                {hasCameraPermission === null && !capturedImage && (
                    <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4 bg-background">
                        <div>
                            <Camera className="h-10 w-10 mx-auto" />
                            <p className="mt-2 font-medium">Requesting camera access...</p>
                            <p className="text-sm">Please allow permission to use your camera.</p>
                        </div>
                    </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
            <DialogFooter className="grid grid-cols-2 gap-2">
                {capturedImage ? (
                    <>
                        <Button variant="outline" onClick={handleRetake} disabled={isSubmitting}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retake
                        </Button>
                        <Button onClick={handleSubmitEvidence} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="mr-2 h-4 w-4" />
                            )}
                            {isSubmitting ? 'Submitting...' : 'Submit'}
                        </Button>
                    </>
                ) : (
                    <Button onClick={handleCapture} disabled={!hasCameraPermission} className="col-span-2">
                        <Camera className="mr-2 h-4 w-4" />
                        Take Photo
                    </Button>
                )}
            </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isLeaveConfirmOpen} onOpenChange={setIsLeaveConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will remove &quot;{selectedProgram?.name}&quot; from your programs. You can rejoin it later from the available programs list.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleLeaveProgram}>Continue</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

    