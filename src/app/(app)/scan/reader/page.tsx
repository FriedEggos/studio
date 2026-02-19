
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeError, Html5QrcodeResult } from 'html5-qrcode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode } from 'lucide-react';
import { useUser } from '@/firebase';

export default function ScanReaderPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Redirect if not logged in
    if (!isUserLoading && !user) {
        router.push('/login?redirect=/scan/reader');
        return;
    }
    
    // Do nothing until user state is determined
    if (isUserLoading || !user) return;


    // Function to handle successful scans
    const onScanSuccess = (decodedText: string, decodedResult: Html5QrcodeResult) => {
      console.log(`Scan result: ${decodedText}`, decodedResult);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner.", error);
        });
      }

      try {
        const url = new URL(decodedText);
        const programId = url.searchParams.get('programId');
        if (url.pathname === '/scan' && programId) {
          router.push(`/scan?programId=${programId}`);
        } else {
          // Handle non-app QR codes or incorrect paths
          alert('Invalid JTMK+ QR Code Scanned.');
          router.push('/dashboard');
        }
      } catch (error) {
        // Handle cases where the QR code is not a valid URL
         alert('Invalid QR Code Format.');
         router.push('/dashboard');
      }
    };
    
    // Function to handle scan errors
    const onScanFailure = (error: Html5QrcodeError) => {
        // This is called frequently, so we typically ignore it unless we want to debug.
        // console.warn(`Code scan error = ${error}`);
    };
    
    // Initialize the scanner
    if (!scannerRef.current) {
        const qrCodeScanner = new Html5QrcodeScanner(
            "qr-reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
        );
        qrCodeScanner.render(onScanSuccess, onScanFailure);
        scannerRef.current = qrCodeScanner;
    }

    // Cleanup function to clear the scanner
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner on unmount.", error);
        });
        scannerRef.current = null;
      }
    };
  }, [router, user, isUserLoading]);

  return (
    <div className="flex justify-center items-center h-full">
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <QrCode className="h-12 w-12 mx-auto text-primary"/>
                <CardTitle className="font-headline mt-4">Scan Program QR Code</CardTitle>
                <CardDescription>Point your camera at the QR code to check-in.</CardDescription>
            </CardHeader>
            <CardContent>
                <div id="qr-reader" className="w-full"></div>
            </CardContent>
        </Card>
    </div>
  );
}

    