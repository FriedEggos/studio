
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, CollectionReference } from "firebase-admin/firestore";
import * as nodemailer from "nodemailer";

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
 * Helper function to recursively delete a collection and its subcollections.
 */
const deleteCollectionRecursive = async (collectionRef: CollectionReference) => {
    const snapshot = await collectionRef.limit(500).get();
    if (snapshot.empty) {
        return;
    }

    const batch = db.batch();
    for (const doc of snapshot.docs) {
        // Recursively delete subcollections
        const subcollections = await doc.ref.listCollections();
        for (const subcollection of subcollections) {
            await deleteCollectionRecursive(subcollection);
        }
        batch.delete(doc.ref);
    }
    await batch.commit();

    // Recurse to delete remaining documents
    await deleteCollectionRecursive(collectionRef);
};


/**
 * Sends a notification email when a student checks in.
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
    
    // --- Email Logic ---
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
 * Sends a thank you/warning email on check-out.
 */
export const onAttendanceCheckOut = onDocumentUpdated("/programs/{programId}/attendances/{attendanceId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // Proceed only if the checkOutAt field was just added.
    if (!beforeData || !afterData || beforeData.checkOutAt || !afterData.checkOutAt) {
        return;
    }

    const studentEmail = afterData.email;
    if (!studentEmail) {
        logger.error("No student email found for document:", event.params.attendanceId);
        return;
    }
    
    // --- Email Logic ---
    const studentName = afterData.studentName || "Pelajar";
    const programDoc = await db.doc(`programs/${event.params.programId}`).get();
    const programTitle = programDoc.exists ? programDoc.data()?.title : "program tersebut";
    
    const checkOutStatus = afterData.checkOutStatus;
    let mailOptions;

    if (checkOutStatus === 'ok' || checkOutStatus === 'admin_override') {
        mailOptions = {
            from: `"JTMK+ System" <${gmailEmail}>`,
            to: studentEmail,
            subject: `Terima Kasih Kerana Menyertai - ${programTitle}`,
            html: `
                <p>Hai ${studentName},</p>
                <p>Terima kasih kerana telah mendaftar keluar dari program <strong>${programTitle}</strong>.</p>
                <p>Kehadiran anda telah disahkan dan direkodkan sepenuhnya.</p>
                <p>Waktu daftar keluar: ${afterData.checkOutAt.toDate().toLocaleString("ms-MY")}</p>
                <br>
                <p>Terima kasih,</p>
                <p>Sistem Kehadiran JTMK+</p>
            `,
        };
    } else {
        const reason = checkOutStatus === 'too_early' ? 'anda mendaftar keluar terlalu awal' 
                     : checkOutStatus === 'outside_window' ? 'anda mendaftar keluar di luar tempoh yang dibenarkan' 
                     : 'tempoh kehadiran anda terlalu singkat';

        mailOptions = {
            from: `"JTMK+ System" <${gmailEmail}>`,
            to: studentEmail,
            subject: `Amaran Status Daftar Keluar - ${programTitle}`,
            html: `
                <p>Hai ${studentName},</p>
                <p>Daftar keluar anda untuk program <strong>${programTitle}</strong> telah direkodkan tetapi dengan amaran.</p>
                <p><strong>Sebab:</strong> Status daftar keluar anda ditandakan sebagai tidak sah kerana ${reason}.</p>
                <p>Waktu daftar keluar: ${afterData.checkOutAt.toDate().toLocaleString("ms-MY")}</p>
                <p>Sila berhubung dengan penganjur program jika anda percaya ini adalah satu kesilapan.</p>
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
});


/**
 * Cleans up all related user data when a user document is deleted.
 * This includes their positions, attendance records, and matriculation ID reservation.
 */
export const onUserDeleted = onDocumentDeleted("/users/{userId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.warn(`onUserDeleted triggered for ${event.params.userId} but snapshot was empty.`);
        return;
    }
    
    const deletedUser = snapshot.data();
    const userId = event.params.userId;
    const userEmail = deletedUser.email;
    const matricId = deletedUser.matricId;

    const promises = [];

    // --- 1. Delete user's 'positions' subcollection ---
    const positionsRef = db.collection('users').doc(userId).collection('positions');
    const deletePositionsPromise = deleteCollectionRecursive(positionsRef)
        .then(() => logger.log(`Successfully deleted positions subcollection for user ${userId}.`))
        .catch(error => logger.error(`Error deleting positions for user ${userId}:`, error));
    promises.push(deletePositionsPromise);

    // --- 2. Clean up user's attendance data by email ---
    if (userEmail) {
        const deleteAttendancesPromise = (async () => {
            try {
                const attendancesSnapshot = await db.collectionGroup('attendances').where('email', '==', userEmail).get();
                if (attendancesSnapshot.empty) {
                    logger.log(`No attendance records found for user with email ${userEmail}.`);
                    return;
                }
                
                // Process deletions in batches of 500
                const batchPromises = [];
                const batchSize = 500;
                for (let i = 0; i < attendancesSnapshot.docs.length; i += batchSize) {
                    const batch = db.batch();
                    const chunk = attendancesSnapshot.docs.slice(i, i + batchSize);
                    chunk.forEach(doc => batch.delete(doc.ref));
                    batchPromises.push(batch.commit());
                }
                
                await Promise.all(batchPromises);
                logger.log(`Successfully deleted ${attendancesSnapshot.size} attendance records for user with email ${userEmail}.`);
            } catch (error) {
                logger.error(`Error deleting attendances for user with email ${userEmail}:`, error);
            }
        })();
        promises.push(deleteAttendancesPromise);
    } else {
        logger.warn(`User document ${userId} deleted without an email. Cannot clean up attendance.`);
    }

    // --- 3. Delete matricId reservation ---
    if (matricId) {
        const matricIdRef = db.doc(`matricIds/${matricId}`);
        const deleteMatricIdPromise = matricIdRef.delete()
            .then(() => logger.log(`Successfully deleted matricId reservation ${matricId} for user ${userId}.`))
            .catch(error => logger.error(`Error deleting matricId reservation for ${matricId}:`, error));
        promises.push(deleteMatricIdPromise);
    } else {
         logger.warn(`User document ${userId} deleted without a matricId. Cannot clean up matricId reservation.`);
    }

    // Wait for all cleanup tasks to complete
    await Promise.all(promises);
    logger.log(`Finished all cleanup tasks for deleted user ${userId}.`);
});
