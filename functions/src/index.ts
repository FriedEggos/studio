
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as nodemailer from "nodemailer";
import { onCall, HttpsError } from "firebase-functions/v2/https";

// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();

// Get environment variables for email credentials
const gmailEmail = process.env.EMAIL_USER;
const gmailPassword = process.env.EMAIL_PASS;

// Create a Nodemailer transporter for sending emails via Gmail
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: gmailEmail,
        pass: gmailPassword,
    },
});

/**
 * Sends a notification email when a student checks in (a new attendance document is created).
 */
export const onAttendanceCheckIn = onDocumentCreated("/programs/{programId}/attendances/{attendanceId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.log("No data associated with the event, skipping.");
        return;
    }

    const attendanceData = snapshot.data();
    const studentEmail = attendanceData.email;
    const studentName = attendanceData.studentName || "Pelajar";

    if (!studentEmail) {
        logger.error("No student email found for document:", event.params.attendanceId);
        return;
    }
    
    // Fetch program details to include in the email
    const programDoc = await db.doc(`programs/${event.params.programId}`).get();
    const programTitle = programDoc.exists ? programDoc.data()?.title : "sebuah program";

    logger.log(`Sending check-in email to ${studentEmail} for program ${programTitle}`);

    const mailOptions = {
        from: `"JTMK+ System" <${gmailEmail}>`,
        to: studentEmail,
        subject: `Kehadiran Anda Telah Direkodkan - ${programTitle}`,
        html: `
            <p>Hai ${studentName},</p>
            <p>Ini adalah pengesahan bahawa kehadiran anda untuk program <strong>${programTitle}</strong> telah berjaya direkodkan.</p>
            <p>Waktu daftar masuk: ${attendanceData.createdAt.toDate().toLocaleString("ms-MY")}</p>
            <p>Jangan lupa untuk mendaftar keluar (check-out) selepas program tamat.</p>
            <br>
            <p>Terima kasih,</p>
            <p>Sistem Kehadiran JTMK+</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        logger.log("Check-in email sent successfully to", studentEmail);
    } catch (error) {
        logger.error("Error sending check-in email:", error);
    }
});


/**
 * Sends a thank you/warning email AND updates user engagement stats when a student checks out.
 */
export const onAttendanceCheckOut = onDocumentUpdated("/programs/{programId}/attendances/{attendanceId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // Proceed only if the checkOutAt field was just added.
    if (!beforeData || !afterData || beforeData.checkOutAt || !afterData.checkOutAt) {
        logger.log("Not a check-out event or already checked out. Skipping.", { attendanceId: event.params.attendanceId });
        return;
    }

    const studentEmail = afterData.email;
    if (!studentEmail) {
        logger.error("No student email found for document:", event.params.attendanceId);
        return;
    }
    
    // --- Task 1: Send Email (existing logic) ---
    const sendEmailTask = async () => {
        const studentName = afterData.studentName || "Pelajar";
        const programDoc = await db.doc(`programs/${event.params.programId}`).get();
        const programTitle = programDoc.exists ? programDoc.data()?.title : "program tersebut";
        
        logger.log(`Sending check-out email to ${studentEmail} for program ${programTitle}`);
        
        const checkOutStatus = afterData.checkOutStatus;
        let mailOptions;

        if (checkOutStatus === 'ok' || checkOutStatus === 'admin_override') {
            mailOptions = {
                from: `"JTMK+ System" <${gmailEmail}>`,
                to: studentEmail,
                subject: `Terima Kasih Kerana Menyertai - ${programTitle}`,
                html: `
                    <p>Hai ${studentName},</p>
                    <p>Terima kasih kerana telah menyertai program <strong>${programTitle}</strong>.</p>
                    <p>Waktu daftar keluar anda pada ${afterData.checkOutAt.toDate().toLocaleString("ms-MY")} telah berjaya direkodkan dan disahkan.</p>
                    <br>
                    <p>Terima kasih,</p>
                    <p>Sistem Kehadiran JTMK+</p>
                `,
            };
        } else {
            mailOptions = {
                from: `"JTMK+ System" <${gmailEmail}>`,
                to: studentEmail,
                subject: `Amaran Status Daftar Keluar - ${programTitle}`,
                html: `
                    <p>Hai ${studentName},</p>
                    <p>Waktu daftar keluar anda untuk program <strong>${programTitle}</strong> pada ${afterData.checkOutAt.toDate().toLocaleString("ms-MY")} telah direkodkan, tetapi ia ditandakan sebagai tidak sah.</p>
                    <p>Status: <strong>${checkOutStatus || 'Tidak diketahui'}</strong>. Ini mungkin kerana anda mendaftar keluar terlalu awal, di luar tetingkap masa yang dibenarkan, atau tempoh kehadiran tidak mencukupi.</p>
                    <p>Sila hubungi penganjur program jika anda merasakan ini adalah satu kesilapan.</p>
                    <br>
                    <p>Terima kasih,</p>
                    <p>Sistem Kehadiran JTMK+</p>
                `,
            };
        }
        
        try {
            await transporter.sendMail(mailOptions);
            logger.log("Check-out email sent successfully to", studentEmail);
        } catch (error) {
            logger.error("Error sending check-out email:", error);
        }
    };
    
    // --- Task 2: Update Engagement Stats (new logic) ---
    const updateStatsTask = async () => {
        // Only run stats update for successful checkouts
        if (afterData.checkOutStatus !== 'ok') {
            logger.log("Checkout status is not 'ok'. Skipping engagement update.", { status: afterData.checkOutStatus });
            return;
        }

        logger.log(`Processing engagement stats for student: ${studentEmail}`);

        try {
            // 1. Get all 'ok' attendances for the user
            const attendancesSnapshot = await db.collectionGroup('attendances')
                .where('email', '==', studentEmail)
                .where('checkOutStatus', '==', 'ok')
                .get();

            const totalOkAttendances = attendancesSnapshot.size;
            const totalOkMinutes = attendancesSnapshot.docs.reduce((sum, doc) => {
                const data = doc.data();
                return sum + (typeof data.durationMinutes === 'number' ? data.durationMinutes : 0);
            }, 0);

            logger.log(`Stats for ${studentEmail}: ${totalOkAttendances} attendances, ${totalOkMinutes} minutes.`);

            // 2. Determine the new badge and rating
            let newBadge: string;
            let newRating: number;

            if (totalOkAttendances >= 25) {
                newBadge = 'Legend';
                newRating = 5;
            } else if (totalOkMinutes >= 1000) {
                newBadge = 'Elite Participant';
                newRating = 4;
            } else if (totalOkAttendances >= 10) {
                newBadge = 'Commitment Pro';
                newRating = 3;
            } else if (totalOkAttendances >= 5) {
                newBadge = 'Active';
                newRating = 2;
            } else if (totalOkAttendances >= 1) {
                newBadge = 'Rookie';
                newRating = 1;
            } else {
                newBadge = '';
                newRating = 0;
            }

            // 3. Find the user document by email
            const userQuery = await db.collection('users').where('email', '==', studentEmail).limit(1).get();

            if (userQuery.empty) {
                logger.warn(`Could not find user document for email: ${studentEmail}`);
                return;
            }

            const userDocRef = userQuery.docs[0].ref;
            const userData = userQuery.docs[0].data();

            // 4. Update the user document only if there's a change
            if (userData.badge !== newBadge || userData.rating !== newRating) {
                await userDocRef.update({
                    badge: newBadge,
                    rating: newRating,
                });
                logger.log(`Successfully updated user ${studentEmail} to Badge: ${newBadge}, Rating: ${newRating}`);
            } else {
                logger.log(`User ${studentEmail} stats are already up-to-date. No update needed.`);
            }

        } catch (error) {
            logger.error(`Error updating engagement stats for ${studentEmail}:`, error);
        }
    };
    
    // Run both tasks in parallel
    await Promise.all([sendEmailTask(), updateStatsTask()]);
});

/**
 * Cleans up a user's attendance data when their user account is deleted.
 */
export const onUserDeleted = onDocumentDeleted("/users/{userId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.log("No data associated with the event, skipping cleanup.");
        return;
    }
    
    const deletedUser = snapshot.data();
    const userEmail = deletedUser.email;

    if (!userEmail) {
        logger.warn(`User document ${event.params.userId} deleted without an email. Cannot clean up attendance.`);
        return;
    }

    logger.log(`User ${userEmail} deleted. Searching for attendance records to clean up.`);

    const attendancesSnapshot = await db.collectionGroup('attendances').where('email', '==', userEmail).get();

    if (attendancesSnapshot.empty) {
        logger.log(`No attendance records found for ${userEmail}. Cleanup not needed.`);
        return;
    }
    
    const batch = db.batch();
    attendancesSnapshot.docs.forEach(doc => {
        logger.log(`Queueing deletion for attendance record at: ${doc.ref.path}`);
        batch.delete(doc.ref);
    });
    
    await batch.commit();
    logger.log(`Successfully deleted ${attendancesSnapshot.size} attendance records for user ${userEmail}.`);
});
