
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
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
 * A central, reusable function to calculate a user's total score and rating from scratch.
 * @param userId The user's unique ID.
 * @param userEmail The user's email address.
 */
async function calculateUserScoreAndRating(userId: string, userEmail: string) {
    logger.log(`Recalculating score for user: ${userEmail} (${userId})`);
    const userDocRef = db.collection('users').doc(userId);

    // 1. Fetch all necessary data in parallel
    const attendancesQuery = db.collectionGroup('attendances')
        .where('email', '==', userEmail)
        .where('checkOutStatus', '==', 'ok');
    
    const achievementsQuery = userDocRef.collection('achievements');

    const [attendancesSnap, achievementsSnap] = await Promise.all([
        attendancesQuery.get(),
        achievementsQuery.get(),
    ]);

    let totalPoints = 0;

    // 2. Calculate points
    // a. Base Attendance Points (+10 for each 'ok' attendance)
    const basePoints = attendancesSnap.size * 10;
    totalPoints += basePoints;
    logger.log(`  - Base points: ${basePoints} for ${attendancesSnap.size} attendances.`);

    // b. Badge (Achievement) Bonuses (+20 per achievement)
    const achievementBonus = achievementsSnap.size * 20;
    totalPoints += achievementBonus;
    if (achievementBonus > 0) {
        logger.log(`  - Achievement bonus: +${achievementBonus} for ${achievementsSnap.size} achievements.`);
    }

    // c. Early Bird Bonus (+30 points) - This requires fetching program docs
    const programFetchPromises = attendancesSnap.docs.map(attDoc => {
        const programId = attDoc.data().programId;
        return db.collection('programs').doc(programId).get();
    });

    const programSnaps = await Promise.all(programFetchPromises);
    let earlyBirdBonuses = 0;
    
    attendancesSnap.docs.forEach((attDoc, index) => {
        const att = attDoc.data();
        const programSnap = programSnaps[index];

        if (programSnap.exists()) {
            const program = programSnap.data();
            if (program && program.startDateTime && att.createdAt) {
                const programStart = (program.startDateTime as Timestamp).toDate();
                const checkInTime = (att.createdAt as Timestamp).toDate();
                const thirtyMinutesBeforeStart = new Date(programStart.getTime() - 30 * 60 * 1000);

                if (checkInTime >= thirtyMinutesBeforeStart && checkInTime < programStart) {
                    totalPoints += 30;
                    earlyBirdBonuses++;
                }
            }
        }
    });
     if (earlyBirdBonuses > 0) {
        logger.log(`  - Early bird bonus: +${earlyBirdBonuses * 30} for ${earlyBirdBonuses} early check-ins.`);
    }

    // 3. Determine rating based on totalPoints
    let rating: number;
    if (totalPoints <= 100) rating = 1;
    else if (totalPoints <= 250) rating = 2;
    else if (totalPoints <= 500) rating = 3;
    else if (totalPoints <= 800) rating = 4;
    else rating = 5;

    logger.log(`  - FINAL SCORE for ${userEmail}: ${totalPoints}, Rating: ${rating}`);

    // 4. Update the User document. Rank is no longer calculated here.
    await userDocRef.update({
        totalScore: totalPoints,
        rating: rating,
    });
}

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
 * Sends a thank you/warning email on check-out AND triggers a score recalculation on valid check-outs.
 */
export const onAttendanceCheckOut = onDocumentUpdated("/programs/{programId}/attendances/{attendanceId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // Proceed only if the checkOutAt field was just added.
    if (!beforeData || !afterData || beforeData.checkOutAt || !afterData.checkOutAt) {
        logger.log("Not a check-out event or already processed. Skipping.", { attendanceId: event.params.attendanceId });
        return;
    }

    const studentEmail = afterData.email;
    if (!studentEmail) {
        logger.error("No student email found for document:", event.params.attendanceId);
        return;
    }
    
    // --- Start Email Logic ---
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

    // --- Start Score Calculation Logic ---
    if (checkOutStatus === 'ok' || checkOutStatus === 'admin_override') {
        // Find the user's document by their email
        const usersSnap = await db.collection('users').where('email', '==', studentEmail).limit(1).get();
        if (usersSnap.empty) {
            logger.warn(`Could not find user with email ${studentEmail} to update score.`);
            return;
        }
        
        const userId = usersSnap.docs[0].id;
        // Call the central calculation function. Do not block the email sending.
        calculateUserScoreAndRating(userId, studentEmail).catch(err => {
            logger.error(`Failed to calculate score for ${studentEmail}`, err);
        });
    }
});


/**
 * Triggers a score recalculation when a new achievement is awarded to a user.
 */
export const onAchievementCreate = onDocumentCreated("/users/{userId}/achievements/{achievementId}", async (event) => {
    const userId = event.params.userId;
    const userSnap = await db.collection('users').doc(userId).get();

    if (!userSnap.exists()) {
        logger.warn(`User ${userId} not found, cannot update score for new achievement.`);
        return;
    }
    const userEmail = userSnap.data()?.email;
    if (!userEmail) {
        logger.error(`User ${userId} has no email, cannot update score.`);
        return;
    }

    // Call the central calculation function.
    calculateUserScoreAndRating(userId, userEmail).catch(err => {
        logger.error(`Failed to calculate score for ${userEmail} on new achievement`, err);
    });
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
