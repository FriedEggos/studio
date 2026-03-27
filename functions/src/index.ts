
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
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
 * Cleans up a user's attendance data when their user account is deleted.
 */
export const onUserDeleted = onDocumentDeleted("/users/{userId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    
    const deletedUser = snapshot.data();
    const userEmail = deletedUser.email;

    if (!userEmail) {
        logger.warn(`User document ${event.params.userId} deleted without an email. Cannot clean up attendance.`);
        return;
    }

    const attendancesSnapshot = await db.collectionGroup('attendances').where('email', '==', userEmail).get();
    if (attendancesSnapshot.empty) return;
    
    const batch = db.batch();
    attendancesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    await batch.commit();
    logger.log(`Successfully deleted ${attendancesSnapshot.size} attendance records for user ${userEmail}.`);
});


/**
 * An HTTP-triggered function to clean up the database for production.
 * Deletes all data from specified collections but preserves admin users.
 * To run, deploy this function and call its URL.
 * It's recommended to secure this function, e.g., by requiring authentication.
 */
export const cleanupProductionDatabase = onRequest({
    timeoutSeconds: 540,
    memory: '1GiB',
}, async (req, res) => {
    logger.info("Starting database cleanup for production...");

    // Helper for recursive deletion.
    const deleteCollectionRecursive = async (collectionRef) => {
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

    try {
        // 1. Delete specified collections entirely
        const collectionsToDelete = ['programs', 'programConfigs', 'qrSlugs'];
        for (const col of collectionsToDelete) {
            logger.info(`Deleting collection: ${col}`);
            const collectionRef = db.collection(col);
            await deleteCollectionRecursive(collectionRef);
            logger.info(`Finished deleting collection: ${col}`);
        }

        // 2. Handle users and their subcollections
        logger.info("Processing users for deletion...");
        const usersRef = db.collection('users');
        const usersSnapshot = await usersRef.get();
        const userDeletionBatch = db.batch();
        let studentsDeleted = 0;

        for (const userDoc of usersSnapshot.docs) {
            if (userDoc.data().role !== 'admin') {
                // Delete 'positions' subcollection for the non-admin user
                const positionsRef = userDoc.ref.collection('positions');
                await deleteCollectionRecursive(positionsRef);
                
                // Add the user document itself to the batch delete
                userDeletionBatch.delete(userDoc.ref);
                studentsDeleted++;
            }
        }
        
        if (studentsDeleted > 0) {
            await userDeletionBatch.commit();
            logger.info(`Deleted ${studentsDeleted} non-admin user documents and their positions.`);
        } else {
            logger.info("No non-admin users found to delete.");
        }
        
        // Note: The onUserDeleted function will also trigger to clean up attendance records
        // associated with the deleted users' emails.

        res.status(200).send("Database cleanup successful. Admin users preserved.");

    } catch (error) {
        logger.error("Error during database cleanup:", error);
        res.status(500).send("Database cleanup failed. Check function logs for details.");
    }
});
