
import { redirect } from 'next/navigation';

/**
 * This page is a leftover from a previous route structure.
 * Redirecting to the correct admin verification page.
 */
export default function RedirectToVerifications() {
  redirect('/admin/verifications');
}
