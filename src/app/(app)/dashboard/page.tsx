
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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { QrCode, ArrowRight, Calendar, X, Camera } from "lucide-react";
import { programs as staticPrograms, myPrograms as staticMyPrograms } from "@/lib/data";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isFuture, isPast, isToday, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";


interface Program {
    id: string;
    name: string;
    date: string;
    description: string;
    imageId: string;
}

export default function StudentDashboard() {
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  
  const [programs, setPrograms] = useState<Program[]>(staticPrograms);
  const [myPrograms, setMyPrograms] = useState<Program[]>(staticMyPrograms);

  const handleOpenProgramModal = (program: Program) => {
    setSelectedProgram(program);
  };

  const handleCloseProgramModal = () => {
    setSelectedProgram(null);
  };

  const handleOpenImageModal = () => {
    if (selectedProgram) {
      setIsImageModalOpen(true);
    }
  };
  
  const handleCloseImageModal = () => {
    setIsImageModalOpen(false);
  };

  const handleOpenQrScanner = () => {
    handleCloseProgramModal(); // Close the details modal first
    setIsQrScannerOpen(true);
  };

  const handleCloseQrScanner = () => {
    setIsQrScannerOpen(false);
    setHasCameraPermission(null);
    // Stop video stream
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };


  const selectedImage = PlaceHolderImages.find(
    (img) => img.id === selectedProgram?.imageId
  );
  
  const isEventUpcoming = selectedProgram ? isFuture(parseISO(selectedProgram.date)) : false;

  const getProgramStatus = (dateString: string): { text: string; variant: "default" | "outline" | "secondary" } => {
    const date = parseISO(dateString);
    if (isToday(date)) {
        return { text: 'Ongoing', variant: 'default' };
    }
    if (isFuture(date)) {
        return { text: 'Coming Soon', variant: 'secondary' };
    }
    if (isPast(date)) {
        return { text: 'Completed', variant: 'outline' };
    }
    return { text: 'Unknown', variant: 'outline' };
  };

  useEffect(() => {
    if (isQrScannerOpen) {
      const getCameraPermission = async () => {
        setHasCameraPermission(null);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
    }
  }, [isQrScannerOpen, toast]);


  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
              Papan Pemuka Pelajar
            </h1>
            <p className="text-muted-foreground">
              Semak program akan datang dan sejarah penyertaan anda.
            </p>
          </div>
        </div>

        <section>
          <h2 className="text-xl font-semibold tracking-tight font-headline mb-4">
            Program Akan Datang
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => {
              const image = PlaceHolderImages.find(
                (img) => img.id === program.imageId
              );
              const status = getProgramStatus(program.date);
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
                      <span>{program.date}</span>
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
                      Lihat Maklumat Lanjut{" "}
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
            Program Saya
          </h2>
           <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {myPrograms.map((program) => {
              const image = PlaceHolderImages.find(
                (img) => img.id === program.imageId
              );
              const status = getProgramStatus(program.date);
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
                      <span>{program.date}</span>
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
                      Lihat Maklumat Lanjut{" "}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
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
                    <span>{selectedProgram?.date}</span>
                 </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-center">
             <Button 
                size="lg"
                disabled={isEventUpcoming}
                onClick={handleOpenQrScanner}
              >
                <QrCode className="mr-2 h-5 w-5" />
                IMBAS QR PROGRAM
              </Button>
          </DialogFooter>
           <DialogClose onClick={handleCloseProgramModal} className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
        </DialogContent>
      </Dialog>

      <Dialog open={isImageModalOpen} onOpenChange={(isOpen) => !isOpen && handleCloseImageModal()}>
        <DialogContent className="p-0 border-0 max-w-4xl bg-transparent shadow-none">
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

      <Dialog open={isQrScannerOpen} onOpenChange={(isOpen) => !isOpen && handleCloseQrScanner()}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="text-center font-headline">Imbas Kod QR Program</DialogTitle>
                <DialogDescription className="text-center">
                    Halakan kamera pada kod QR yang disediakan oleh penganjur.
                </DialogDescription>
            </DialogHeader>
            <div className="p-4 rounded-lg border bg-muted relative aspect-square flex items-center justify-center">
                <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted />
                {hasCameraPermission === false && (
                    <Alert variant="destructive" className="absolute bottom-4 left-4 right-4">
                      <Camera className="h-4 w-4" />
                      <AlertTitle>Camera Access Required</AlertTitle>
                      <AlertDescription>
                        Please allow camera access to scan QR codes.
                      </AlertDescription>
                    </Alert>
                )}
                 {hasCameraPermission === null && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80">
                        <Camera className="h-12 w-12 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">Requesting camera access...</p>
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={handleCloseQrScanner} className="w-full">
                    Batal
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
