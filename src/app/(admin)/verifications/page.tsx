
import { redirect } from 'next/navigation';

/**
 * Redirecting to the canonical admin verification page.
 */
export default function RedirectToAdminVerifications() {
  redirect('/admin/verifications');
}
