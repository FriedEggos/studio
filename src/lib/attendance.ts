'use client';

import { doc, updateDoc, Firestore, serverTimestamp } from 'firebase/firestore';

/**
 * Submits the check-out data for an attendance record.
 * This function is specifically designed to only update the fields
 * allowed by the Firestore security rules for a check-out operation.
 *
 * @param db The Firestore instance.
 * @param programId The ID of the program.
 * @param attendanceId The ID of the attendance record (student's email).
 * @param data An object containing the check-out data.
 */
export async function submitCheckout(
    db: Firestore,
    programId: string,
    attendanceId: string,
    data: {
        checkOutLat: number | null;
        checkOutLng: number | null;
        checkOutStatus: string;
        durationMinutes: number;
    }
) {
    if (!db || !programId || !attendanceId) {
        throw new Error("Invalid arguments provided to submitCheckout.");
    }

    const attendanceDocRef = doc(db, "programs", programId, "attendances", attendanceId);

    const checkoutUpdatePayload = {
        ...data,
        checkOutAt: serverTimestamp(),
    };

    // This update only sends the 5 allowed fields to Firestore, as per security rules.
    await updateDoc(attendanceDocRef, checkoutUpdatePayload);
}
