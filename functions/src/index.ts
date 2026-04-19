
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, CollectionReference } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();

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

    // --- 1. Delete user's 'positions' (contributions) subcollection ---
    const positionsRef = db.collection('users').doc(userId).collection('positions');
    const deletePositionsPromise = (async () => {
        try {
            const query = positionsRef.limit(500);
            let snapshot = await query.get();
            // Loop to delete documents in batches of 500
            while(snapshot.size > 0) {
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                snapshot = await query.get(); // Get the next batch
            }
            logger.log(`Successfully deleted positions subcollection for user ${userId}.`);
        } catch (error) {
            logger.error(`Error deleting positions for user ${userId}:`, error);
        }
    })();
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
