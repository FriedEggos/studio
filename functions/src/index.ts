
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as nodemailer from "nodemailer";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

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
 * Sends a thank you/warning email when a student checks out.
 * Point and rating calculations are now handled by the 'updateGlobalRanking' scheduled function.
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

/**
 * Scheduled function that runs every 30 minutes to calculate and update student scores, ratings, and ranks.
 */
export const updateGlobalRanking = onSchedule("every 30 minutes", async (event) => {
    logger.log("Starting scheduled job: updateGlobalRanking");

    try {
        // 1. Fetch all necessary data
        const usersSnapshot = await db.collection('users').where('role', '==', 'student').get();
        if (usersSnapshot.empty) {
            logger.log("No student users found. Exiting job.");
            return;
        }

        const programsSnapshot = await db.collection('programs').get();
        const programsMap = new Map(programsSnapshot.docs.map(doc => [doc.id, doc.data()]));

        const attendancesSnapshot = await db.collectionGroup('attendances').where('checkOutStatus', '==', 'ok').get();
        const userAttendances = new Map<string, any[]>();
        attendancesSnapshot.forEach(doc => {
            const data = doc.data();
            if (!userAttendances.has(data.email)) {
                userAttendances.set(data.email, []);
            }
            userAttendances.get(data.email)!.push(data);
        });

        const userAchievements = new Map<string, number>();
        const achievementPromises = usersSnapshot.docs.map(async userDoc => {
            const achievementsSnapshot = await db.collection('users').doc(userDoc.id).collection('achievements').get();
            userAchievements.set(userDoc.id, achievementsSnapshot.size);
        });
        await Promise.all(achievementPromises);

        logger.log(`Processing ${usersSnapshot.size} users.`);

        // 2. Calculate scores for each user
        const userScores = usersSnapshot.docs.map(userDoc => {
            const user = userDoc.data();
            let totalPoints = 0;

            const studentAttendances = userAttendances.get(user.email) || [];
            
            // a. Base Attendance Points (+10 for each 'ok' attendance)
            totalPoints += studentAttendances.length * 10;
            
            // b. Early Bird Bonus (+30 points)
            studentAttendances.forEach((att: any) => {
                const program = programsMap.get(att.programId);
                if (program && program.startDateTime && att.createdAt) {
                    const programStart = (program.startDateTime as Timestamp).toDate();
                    const checkInTime = (att.createdAt as Timestamp).toDate();
                    
                    const thirtyMinutesBeforeStart = new Date(programStart.getTime() - 30 * 60 * 1000);

                    if (checkInTime >= thirtyMinutesBeforeStart && checkInTime < programStart) {
                        totalPoints += 30;
                    }
                }
            });
            
            // c. Badge (Achievement) Bonuses (+20 per achievement)
            const achievementCount = userAchievements.get(userDoc.id) || 0;
            totalPoints += achievementCount * 20;
            
            // d. Determine rating based on totalPoints
            let rating: number;
            if (totalPoints <= 100) rating = 1;
            else if (totalPoints <= 250) rating = 2;
            else if (totalPoints <= 500) rating = 3;
            else if (totalPoints <= 800) rating = 4;
            else rating = 5;

            return { id: userDoc.id, totalScore: totalPoints, rating: rating };
        });

        // 3. Sort users by score to determine rank
        userScores.sort((a, b) => b.totalScore - a.totalScore);

        // 4. Batch update user documents
        const batch = db.batch();
        userScores.forEach((scoredUser, index) => {
            const userRef = db.collection('users').doc(scoredUser.id);
            batch.update(userRef, {
                totalScore: scoredUser.totalScore,
                rating: scoredUser.rating,
                rank: index + 1,
            });
        });

        await batch.commit();
        logger.log(`Successfully updated ranks, scores, and ratings for ${userScores.length} users.`);

    } catch (error) {
        logger.error("Error in updateGlobalRanking job:", error);
    }
});
