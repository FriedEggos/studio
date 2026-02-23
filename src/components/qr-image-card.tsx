
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

// Using img tag because next/image doesn't support Google Charts API URLs by default.
/* eslint-disable @next/next/no-img-element */

export function QRImageCard({ qrFormUrl, programTitle }: { qrFormUrl: string, programTitle: string }) {

  const handleDownload = () => {
    const qrApiUrl = `https://chart.googleapis.com/chart?cht=qr&chl=${encodeURIComponent(qrFormUrl)}&chs=512x512&chld=H|0`;
    
    // We create an anchor tag to trigger the download.
    // The 'download' attribute tells the browser to download the file instead of navigating.
    const downloadLink = document.createElement('a');
    downloadLink.href = qrApiUrl;
    
    // Suggest a filename for the downloaded image.
    downloadLink.download = `qr-code-${programTitle.replace(/\s+/g, '-').toLowerCase()}.png`;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center justify-between">
          <span>QR Code</span>
           <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </CardTitle>
        <CardDescription>
          Scan this code to open the public attendance form.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 text-center">
        <div className="bg-white p-4 rounded-lg border">
          <img
            src={`https://chart.googleapis.com/chart?cht=qr&chl=${encodeURIComponent(
              qrFormUrl
            )}&chs=200x200&chld=H|0`}
            alt="QR Code"
            className="rounded-md"
            width="200"
            height="200"
          />
        </div>
      </CardContent>
    </Card>
  );
}
