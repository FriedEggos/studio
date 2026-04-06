// A one-time script to manually add a student attendance record to a Firestore event.

const admin = require('firebase-admin');

// --- START: Configuration ---

// 1. Service Account: Replace with your service account credentials file path.
const serviceAccount = require('./serviceAccountKey.json');

// 2. Target Event: The name of the event (program) to add the record to.
const TARGET_EVENT_NAME = 'CTF Challenge';

// 3. Student Data: The list of student records to add.
// IMPORTANT: You MUST provide a unique 'email' for each student. This email is used as the document ID
// and must not already exist in the target event's attendance. A 'phone' number is also required.
const studentsToAdd = [
  {
    studentName: 'ALIYA MUNIRAH BINTI MOHAMMAD',
    studentId: '05DIT25F1001',
    email: 'aliya.m.05dit25f1001@example.com', // <-- IMPORTANT: Please provide a real, unique email.
    phone: '010-0000000', // <-- IMPORTANT: Please provide a real phone number.
    classGroup: 'DIT2C',
    checkInTime: '2026-04-06T08:34:13', // ISO 8601 Format (YYYY-MM-DDTHH:mm:ss)
    checkOutTime: null, // Use null for N/A
  },
  // Add more student objects here if needed
];

// --- END: Configuration ---


// --- Script Logic ---

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function addAttendanceRecords() {
  console.log(`Starting attendance creation for event: "${TARGET_EVENT_NAME}"...`);

  let programId = '';
  let programFound = false;

  // 1. Find the program ID for the target event name
  try {
    const programsRef = db.collection('programs');
    const snapshot = await programsRef.where('title', '==', TARGET_EVENT_NAME).limit(1).get();

    if (snapshot.empty) {
      console.error(`\n[ERROR] Program with title "${TARGET_EVENT_NAME}" not found. Please check the TARGET_EVENT_NAME configuration.`);
      console.error('Script cannot continue. Exiting.');
      return;
    }

    snapshot.forEach(doc => {
      programId = doc.id;
      programFound = true;
    });
    console.log(`Found program "${TARGET_EVENT_NAME}" with ID: ${programId}`);
  } catch (error) {
    console.error('\n[ERROR] Failed to query for program:', error);
    console.error('Please ensure your Firestore indexes are set up correctly and the service account has permission.');
    return;
  }

  if (!programFound) return;

  // 2. Process each student record
  const attendanceRef = db.collection(`programs/${programId}/attendances`);
  let addedCount = 0;
  let skippedCount = 0;

  for (const student of studentsToAdd) {
    const studentIdentifier = `${student.studentName} (Email: ${student.email})`;
    const docId = student.email.toLowerCase().trim();
    
    if (!docId) {
        console.warn(`[SKIPPED] ${studentIdentifier} - Email is missing. Cannot create record.`);
        skippedCount++;
        continue;
    }

    const newRecordRef = attendanceRef.doc(docId);

    try {
      const doc = await newRecordRef.get();
      if (doc.exists) {
        console.warn(`[SKIPPED] ${studentIdentifier} - Attendance record with this email already exists in "${TARGET_EVENT_NAME}".`);
        skippedCount++;
        continue;
      }

      const checkInTimestamp = student.checkInTime ? admin.firestore.Timestamp.fromDate(new Date(student.checkInTime)) : null;
      const checkOutTimestamp = student.checkOutTime ? admin.firestore.Timestamp.fromDate(new Date(student.checkOutTime)) : null;

      const newRecord = {
        studentName: student.studentName.toUpperCase(),
        studentId: student.studentId.toUpperCase(),
        email: student.email,
        phone: student.phone,
        classGroup: student.classGroup,
        programId: programId,
        createdAt: checkInTimestamp,
        checkOutAt: checkOutTimestamp,
        checkOutStatus: null,
        durationMinutes: null,
        userAgent: 'manual-script-add',
      };
      
      // Remove null values so they are not written to Firestore
      Object.keys(newRecord).forEach(key => newRecord[key] === null && delete newRecord[key]);

      await newRecordRef.set(newRecord);
      console.log(`[SUCCESS] Added attendance for ${studentIdentifier}.`);
      addedCount++;
    } catch (error) {
      console.error(`\n[ERROR] Failed to process record for ${studentIdentifier}:`, error);
    }
  }

  // 3. Final summary
  console.log('\n--- Script Complete ---');
  console.log(`Total records to process: ${studentsToAdd.length}`);
  console.log(`Successfully added: ${addedCount}`);
  console.log(`Skipped (already exist or missing email): ${skippedCount}`);
  console.log('--------------------------\n');
}

addAttendanceRecords().catch(error => {
  console.error('An unexpected error occurred during the script execution:', error);
});
