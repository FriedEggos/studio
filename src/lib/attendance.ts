
'use client';

import { doc, updateDoc, Firestore, serverTimestamp, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { differenceInMinutes, parseISO } from 'date-fns';

/**
 * Creates a new attendance record (check-in) after performing validation.
 * @param db Firestore instance.
 * @param programId ID of the program.
 * @param formData Data from the attendance form.
 * @returns An object with status and a message.
 */
export async function createCheckIn(
    db: Firestore,
    programId: string,
    formData: any
) {
    const now = new Date();
    const programDocRef = doc(db, 'programs', programId);
    const programSnap = await getDoc(programDocRef);

    if (!programSnap.exists()) {
        return { status: 'error', message: 'Program not found.' };
    }

    const program = programSnap.data();
    
    const checkInOpen = (program.checkInOpenTime as Timestamp).toDate();
    const checkInClose = (program.checkInCloseTime as Timestamp).toDate();

    // Validate check-in time
    if (now < checkInOpen) {
        return { status: 'too_early', message: 'Check-in has not opened yet.' };
    }
    if (now > checkInClose) {
        return { status: 'too_late', message: 'Check-in has already closed.' };
    }
    
    // Use student's email as the document ID to prevent duplicates
    const studentEmail = formData.email.toLowerCase().trim();
    const attendanceDocRef = doc(db, 'programs', programId, 'attendances', studentEmail);

    await setDoc(attendanceDocRef, {
        ...formData,
        programId: programId,
        createdAt: serverTimestamp(), // This is the checkInAt time
        userAgent: navigator.userAgent,
    }, { merge: true });

    return { status: 'success', message: 'Check-in successful!' };
}


/**
 * Submits the check-out data for an attendance record after validation.
 *
 * @param db The Firestore instance.
 * @param programId The ID of the program.
 * @param attendanceId The ID of the attendance record (student's email).
 * @returns An object with status and a message.
 */
export async function submitCheckout(
    db: Firestore,
    programId: string,
    attendanceId: string
) {
    const now = new Date();
    const attendanceDocRef = doc(db, 'programs', programId, 'attendances', attendanceId);
    const programDocRef = doc(db, 'programs', programId);

    const [attendanceSnap, programSnap] = await Promise.all([
        getDoc(attendanceDocRef),
        getDoc(programDocRef),
    ]);

    if (!attendanceSnap.exists()) {
        return { status: 'not_found', message: 'Attendance record not found.' };
    }
    if (!programSnap.exists()) {
        return { status: 'error', message: 'Program not found.' };
    }

    const attendanceData = attendanceSnap.data();
    const programData = programSnap.data();

    if (attendanceData.checkOutAt) {
        return { status: 'already_checked_out', message: 'You have already checked out.' };
    }

    const checkInAt = (attendanceData.createdAt as Timestamp).toDate();
    const checkOutOpenTime = programData?.checkOutOpenTime ? (programData.checkOutOpenTime as Timestamp).toDate() : null;
    const checkOutCloseTime = programData?.checkOutCloseTime ? (programData.checkOutCloseTime as Timestamp).toDate() : null;
    const durationMinutes = differenceInMinutes(now, checkInAt);
    
    let checkOutStatus: string = "ok";

    // Rule A: Must be after check-in
    if (now <= checkInAt) {
        checkOutStatus = "too_early";
    }
    // Rule B: Must be inside admin-defined check-out window
    else if (checkOutOpenTime && now < checkOutOpenTime) {
        checkOutStatus = "outside_window";
    }
    else if (checkOutCloseTime && now > checkOutCloseTime) {
        checkOutStatus = "outside_window";
    }

    // This payload contains ONLY the fields allowed by the `isCheckoutUpdate` security rule.
    const checkoutUpdatePayload = {
        checkOutAt: serverTimestamp(),
        checkOutStatus: checkOutStatus,
        durationMinutes: durationMinutes,
    };

    await updateDoc(attendanceDocRef, checkoutUpdatePayload);

    return { status: 'success', message: 'Check-out successful!' };
}

/**
 * Force-updates an attendance record to mark it as checked-out by an admin.
 * Skips all validation rules.
 * @param db Firestore instance.
 * @param programId ID of the program.
 * @param attendanceId ID of the attendance record (student's email).
 * @returns An object with status and a message.
 */
export async function manualAdminCheckout(
    db: Firestore,
    programId: string,
    attendanceId: string
) {
    const attendanceDocRef = doc(db, 'programs', programId, 'attendances', attendanceId);
    const attendanceSnap = await getDoc(attendanceDocRef);

    if (!attendanceSnap.exists()) {
        return { status: 'error', message: 'Attendance record not found.' };
    }
    
    const attendanceData = attendanceSnap.data();

    if (attendanceData.checkOutAt) {
        return { status: 'error', message: 'This user has already checked out.' };
    }

    const checkInAt = (attendanceData.createdAt as Timestamp).toDate();
    const durationMinutes = differenceInMinutes(new Date(), checkInAt);

    const overridePayload = {
        checkOutAt: serverTimestamp(),
        checkOutStatus: 'admin_override',
        durationMinutes: durationMinutes >= 0 ? durationMinutes : 0,
    };

    try {
        await updateDoc(attendanceDocRef, overridePayload);
        return { status: 'success', message: 'User has been manually checked out.' };
    } catch (error) {
        console.error("Admin checkout override failed:", error);
        return { status: 'error', message: 'Failed to update the attendance record.' };
    }
}
