
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as nodemailer from "nodemailer";
import { onCall, HttpsError } from "firebase-functions/v2/https";

// Initialize Firebase Admin SDK
initializeApp();

// Get environment variables for email credentials from Firebase environment
// You must set these using the Firebase CLI:
// firebase functions:config:set nodemailer.email="YOUR_GMAIL" nodemailer.password="YOUR_APP_PASSWORD"
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
    const programDoc = await getFirestore().doc(`programs/${event.params.programId}`).get();
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
 * Sends a thank you or warning email when a student checks out.
 */
export const onAttendanceCheckOut = onDocumentUpdated("/programs/{programId}/attendances/{attendanceId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // Proceed only if the checkOutAt field was just added.
    if (!beforeData || !afterData || beforeData.checkOutAt || !afterData.checkOutAt) {
        logger.log("Not a check-out event or already checked out. Skipping email.");
        return;
    }

    const studentEmail = afterData.email;
    const studentName = afterData.studentName || "Pelajar";

    if (!studentEmail) {
        logger.error("No student email found for document:", event.params.attendanceId);
        return;
    }
    
    // Fetch program details to include in the email
    const programDoc = await getFirestore().doc(`programs/${event.params.programId}`).get();
    const programTitle = programDoc.exists ? programDoc.data()?.title : "program tersebut";
    
    logger.log(`Sending check-out email to ${studentEmail} for program ${programTitle}`);
    
    const checkOutStatus = afterData.checkOutStatus;
    let mailOptions;

    if (checkOutStatus === 'ok' || checkOutStatus === 'admin_override') {
        // Send a "Thank You" email for successful checkouts
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
        // Send a warning email for invalid checkouts
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
});

/**
 * A callable function for admins to backfill a 'Pioneer' badge for old users.
 */
export const backfillPioneerBadge = onCall({ region: "us-central1" }, async (request) => {
    // 1. Authentication Check
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    
    const uid = request.auth.uid;
    const db = getFirestore();

    // 2. Authorization Check: Ensure the caller is an admin.
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
       throw new HttpsError('permission-denied', 'This function can only be called by an administrator.');
    }
    
    logger.info(`Admin ${uid} initiated Pioneer badge backfill.`);

    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    if (snapshot.empty) {
        logger.info('No users found to process.');
        return { status: 'success', message: 'No users found.' };
    }

    const batch = db.batch();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let usersUpdated = 0;

    for (const doc of snapshot.docs) {
        const userData = doc.data();
        const createdAt = (userData.createdAt as Timestamp)?.toDate();
        
        const achievementRef = doc.ref.collection('achievements').doc('pioneer-badge-01');
        const achievementSnap = await achievementRef.get();
        
        // Check if user qualifies and if they don't already have the badge
        if (createdAt && createdAt < sevenDaysAgo && !achievementSnap.exists) {
            logger.info(`User ${doc.id} (${userData.displayName}) qualifies for the Pioneer badge.`);
            
            batch.set(achievementRef, {
                badgeId: 'pioneer-badge-01',
                badgeName: 'Pioneer',
                earnedAt: Timestamp.now(),
                criteriaMet: 'User account created more than 7 days ago.'
            });

            usersUpdated++;
        }
    }

    if (usersUpdated > 0) {
        await batch.commit();
        const message = `Successfully added the Pioneer badge to ${usersUpdated} users.`;
        logger.info(message);
        return { status: 'success', message };
    } else {
        const message = 'No new users qualified for the Pioneer badge.';
        logger.info(message);
        return { status: 'success', message };
    }
});
