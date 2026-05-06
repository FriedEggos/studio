'use client';

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * This page is a leftover from a previous route structure.
 * Redirecting to the correct admin verification page.
 */
export default function RedirectToVerifications() {
  redirect('/admin/verifications');
}
