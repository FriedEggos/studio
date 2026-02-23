
'use client';

import { doc, updateDoc, Firestore, serverTimestamp, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { differenceInMinutes, parseISO, subMinutes } from 'date-fns';
import { getDistance } from './location';

interface Location {
    latitude: number;
    longitude: number;
}

/**
 * Creates a new attendance record (check-in) after performing validation.
 * @param db Firestore instance.
 * @param programId ID of the program.
 * @param formData Data from the attendance form.
 * @param location User's current location.
 * @returns An object with status and a message.
 */
export async function createCheckIn(
    db: Firestore,
    programId: string,
    formData: any,
    location: Location | null
) {
    const now = new Date();
    const programDocRef = doc(db, 'programs', programId);
    const programSnap = await getDoc(programDocRef);

    if (!programSnap.exists()) {
        return { status: 'error', message: 'Program not found.' };
    }

    const program = programSnap.data();
    const programStart = parseISO(program.startDate);
    const programEnd = parseISO(program.endDate);
    const checkInOpen = subMinutes(programStart, 15);

    // Validate check-in time
    if (now < checkInOpen) {
        return { status: 'too_early', message: 'Check-in has not opened yet.' };
    }
    if (now > programEnd) {
        return { status: 'too_late', message: 'Check-in has already closed.' };
    }
    
    // Use student's email as the document ID to prevent duplicates
    const studentEmail = formData.email.toLowerCase().trim();
    const attendanceDocRef = doc(db, 'programs', programId, 'attendances', studentEmail);

    await setDoc(attendanceDocRef, {
        ...formData,
        programId: programId,
        createdAt: serverTimestamp(), // This is the checkInAt time
        checkInLat: location?.latitude || null,
        checkInLng: location?.longitude || null,
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
 * @param location The user's current GPS location.
 * @returns An object with status and a message.
 */
export async function submitCheckout(
    db: Firestore,
    programId: string,
    attendanceId: string,
    location: Location | null
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
    const checkOutOpenTime = programData?.checkOutOpenTime ? parseISO(programData.checkOutOpenTime) : null;
    const checkOutCloseTime = programData?.checkOutCloseTime ? parseISO(programData.checkOutCloseTime) : null;
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
    // Rule C: Minimum duration
    else if (durationMinutes < 60) {
        checkOutStatus = "too_short";
    }
    // Rule D: GPS validation
    else if (!location) {
        checkOutStatus = "geo_failed";
    } else if (programData?.venueLat && programData?.venueLng && programData?.allowedRadiusMeters) {
        const distance = getDistance(location.latitude, location.longitude, programData.venueLat, programData.venueLng);
        if (distance > programData.allowedRadiusMeters) {
            checkOutStatus = "geo_failed";
        }
    }

    // This payload contains ONLY the fields allowed by the `isCheckoutUpdate` security rule.
    const checkoutUpdatePayload = {
        checkOutAt: serverTimestamp(),
        checkOutLat: location?.latitude || null,
        checkOutLng: location?.longitude || null,
        checkOutStatus: checkOutStatus,
        durationMinutes: durationMinutes,
    };

    await updateDoc(attendanceDocRef, checkoutUpdatePayload);

    return { status: 'success', message: 'Check-out successful!' };
}
