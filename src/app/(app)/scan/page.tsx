
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DeprecatedScanPage() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle>Page Not Found</CardTitle>
                    <CardDescription>This page is no longer in use.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="mb-4">The QR code scanning functionality has been updated. Please use your device's native camera to scan program QR codes.</p>
                    <Button asChild>
                        <Link href="/dashboard">Go to Dashboard</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
