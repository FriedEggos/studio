import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/* eslint-disable @next/next/no-img-element */

export function QRImageCard({ qrFormUrl }: { qrFormUrl: string }) {
  if (!qrFormUrl) {
    return null;
  }

  const qrSrc = `https://quickchart.io/qr?text=${encodeURIComponent(
    qrFormUrl
  )}&size=300`;

  return (
    <Card>
        <CardHeader>
            <CardTitle className="font-headline">QR Code</CardTitle>
            <CardDescription>
                Scan this code to open the public attendance form.
            </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-lg bg-white p-4 border">
                <img
                    src={qrSrc}
                    alt="QR Code"
                    className="h-48 w-48 rounded-md"
                />
            </div>
            <p className="break-all text-xs text-muted-foreground">
                {qrFormUrl}
            </p>
      </CardContent>
    </Card>
  );
}
