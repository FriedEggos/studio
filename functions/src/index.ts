
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
 * A central, reusable function to calculate a user's total score, rating, and award badges.
 * @param userId The user's unique ID.
 * @param userEmail The user's email address.
 */
async function calculateUserScoreAndRating(userId: string, userEmail: string) {
    logger.log(`Recalculating score and badges for user: ${userEmail} (${userId})`);
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

    const totalAttendances = attendancesSnap.size;
    const existingBadges = new Set(achievementsSnap.docs.map(doc => doc.id));

    // 2. Fetch all required program documents for bonus calculations
    const programFetchPromises = attendancesSnap.docs.map(attDoc => {
        const programId = attDoc.data().programId;
        return db.collection('programs').doc(programId).get();
    });
    const programSnaps = await Promise.all(programFetchPromises);

    // 3. Calculate points and duration
    let totalPoints = 0;
    let totalDuration = 0;
    let earlyCheckInBonuses = 0;
    let earlyCheckOutBonuses = 0;

    // a. Base Attendance & Duration
    totalPoints += totalAttendances * 10;
    attendancesSnap.docs.forEach(attDoc => {
        totalDuration += (attDoc.data().durationMinutes || 0);
    });

    // b. Badge Bonuses
    totalPoints += existingBadges.size * 20;

    // c. Early Bird & Early Checkout Bonuses
    attendancesSnap.docs.forEach((attDoc, index) => {
        const att = attDoc.data();
        const programSnap = programSnaps[index];

        if (programSnap.exists()) {
            const program = programSnap.data();

            // Early Check-in Bonus
            if (program && program.startDateTime && att.createdAt) {
                const programStart = (program.startDateTime as Timestamp).toDate();
                const checkInTime = (att.createdAt as Timestamp).toDate();
                const thirtyMinutesBeforeStart = new Date(programStart.getTime() - 30 * 60 * 1000);
                if (checkInTime >= thirtyMinutesBeforeStart && checkInTime < programStart) {
                    totalPoints += 30;
                    earlyCheckInBonuses++;
                }
            }

            // Early Check-out Bonus
            if (program && att.checkOutAt && program.checkOutOpenTime) {
                const checkOutTime = (att.checkOutAt as Timestamp).toDate();
                const checkOutOpen = (program.checkOutOpenTime as Timestamp).toDate();
                const thirtyMinutesAfterOpen = new Date(checkOutOpen.getTime() + 30 * 60 * 1000);
                if (checkOutTime >= checkOutOpen && checkOutTime < thirtyMinutesAfterOpen) {
                    totalPoints += 30;
                    earlyCheckOutBonuses++;
                }
            }
        }
    });
    
    // 4. Determine rating based on totalPoints
    let rating: number;
    if (totalPoints <= 100) rating = 1;
    else if (totalPoints <= 250) rating = 2;
    else if (totalPoints <= 500) rating = 3;
    else if (totalPoints <= 800) rating = 4;
    else rating = 5;

    // 5. Award new badges if criteria are met
    const badgeCriteria = {
        'Rookie': { met: totalAttendances >= 1, desc: 'Attended your first program.' },
        'Active': { met: totalAttendances >= 5, desc: 'Attended 5 programs.' },
        'Commitment Pro': { met: totalAttendances >= 10, desc: 'Attended 10 programs.' },
        'Elite Participant': { met: totalDuration > 1000, desc: 'Accumulated over 1000 participation minutes.' },
        'Legend': { met: rating === 5, desc: 'Achieved a 5-star rating.' },
    };

    const batch = db.batch();
    const achievementsRef = userDocRef.collection('achievements');
    let newBadgesAwarded = false;

    for (const [badgeName, { met, desc }] of Object.entries(badgeCriteria)) {
        if (met && !existingBadges.has(badgeName)) {
            const newBadgeRef = achievementsRef.doc(badgeName);
            batch.set(newBadgeRef, {
                badgeId: badgeName,
                badgeName: badgeName.replace(/([A-Z])/g, ' $1').trim(),
                earnedAt: Timestamp.now(),
                criteriaMet: desc,
            });
            existingBadges.add(badgeName); // Add to set to prevent re-awarding and for highest badge logic
            newBadgesAwarded = true;
            logger.log(`  - Awarding new badge: ${badgeName} to ${userEmail}`);
        }
    }
    if (newBadgesAwarded) {
        await batch.commit(); // Commit batch to award badges
        // Point calculation will be re-triggered by onAchievementCreate, so we can stop here.
        logger.log(`New badges awarded. Score recalculation will be triggered. Halting current execution for ${userEmail}.`);
        return;
    }

    // 6. Determine highest badge earned
    const badgeHierarchy = ['Legend', 'Elite Participant', 'Commitment Pro', 'Active', 'Rookie'];
    const highestBadge = badgeHierarchy.find(b => existingBadges.has(b)) || null;

    // 7. Log final calculation details
    logger.log(`  - Base points: ${totalAttendances * 10} for ${totalAttendances} attendances.`);
    logger.log(`  - Badge bonus: ${achievementsSnap.size * 20} for ${achievementsSnap.size} badges.`);
    if (earlyCheckInBonuses > 0) logger.log(`  - Early check-in bonus: +${earlyCheckInBonuses * 30}`);
    if (earlyCheckOutBonuses > 0) logger.log(`  - Early check-out bonus: +${earlyCheckOutBonuses * 30}`);
    logger.log(`  - FINAL SCORE for ${userEmail}: ${totalPoints}, Rating: ${rating}, Highest Badge: ${highestBadge}`);

    // 8. Update the User document
    await userDocRef.update({
        totalScore: totalPoints,
        rating: rating,
        badge: highestBadge,
    });
}

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
            html: `...`, // Email body omitted for brevity
        };
    } else {
        mailOptions = {
            from: `"JTMK+ System" <${gmailEmail}>`,
            to: studentEmail,
            subject: `Amaran Status Daftar Keluar - ${programTitle}`,
            html: `...`, // Email body omitted for brevity
        };
    }
    
    try {
        await transporter.sendMail(mailOptions);
        logger.log("Check-out email sent successfully to", studentEmail);
    } catch (error) {
        logger.error("Error sending check-out email:", error);
    }

    // --- Score Calculation Trigger ---
    if (checkOutStatus === 'ok' || checkOutStatus === 'admin_override') {
        const usersSnap = await db.collection('users').where('email', '==', studentEmail).limit(1).get();
        if (usersSnap.empty) {
            logger.warn(`Could not find user with email ${studentEmail} to update score.`);
            return;
        }
        
        const userId = usersSnap.docs[0].id;
        await calculateUserScoreAndRating(userId, studentEmail).catch(err => {
            logger.error(`Failed to calculate score for ${studentEmail}:`, err);
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

    await calculateUserScoreAndRating(userId, userEmail).catch(err => {
        logger.error(`Failed to calculate score for ${userEmail} on new achievement:`, err);
    });
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
