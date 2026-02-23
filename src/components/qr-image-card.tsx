import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "./ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* eslint-disable @next/next/no-img-element */

export function QRImageCard({ 
  qrUrl, 
  title, 
  description 
}: { 
  qrUrl: string; 
  title: string; 
  description: string;
}) {
  const { toast } = useToast();

  if (!qrUrl) {
    return null;
  }

  const qrSrc = `https://quickchart.io/qr?text=${encodeURIComponent(qrUrl)}&size=300`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrUrl);
    toast({ title: "Link Copied!", description: "The link has been copied to your clipboard." });
  };

  return (
    <Card>
        <CardHeader>
            <CardTitle className="font-headline">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-lg bg-white p-4 border">
                <img
                    src={qrSrc}
                    alt="QR Code"
                    className="h-48 w-48"
                />
            </div>
            <div className="flex w-full items-center gap-2 p-2 border rounded-md bg-muted">
                <p className="text-sm text-muted-foreground truncate flex-1 text-left">{qrUrl}</p>
                <Button variant="ghost" size="icon" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
            </div>
      </CardContent>
    </Card>
  );
}
