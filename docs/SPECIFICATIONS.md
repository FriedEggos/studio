# System Requirement Specification

This document outlines the user, functional, non-functional, and security requirements for the JTMK+ System, a QR-based program participation and committee role verification system.

## 1.0 User Requirements

This section describes the goals and tasks that different users need to accomplish with the system.

### 1.1 Student User Requirements

#### 1.1.1 Account & Profile
*   **1.1.1.1 Registration & Access:** Users must be able to create an account and log in securely to access their personal records.
*   **1.1.1.2 Profile Management:** Students must be able to view and edit their profile information, including their full name, matric ID, phone number, and department.

#### 1.1.2 Program Participation
*   **1.1.2.1 View Programs:** Students must be able to view a dashboard of all ongoing, upcoming, and completed programs.
*   **1.1.2.2 Check-in:** Students must be able to check into a program by scanning a QR code which leads to a public attendance form.
*   **1.1.2.3 Check-out:** Students must be able to check out from a program to complete their attendance record.
*   **1.1.2.4 View Participation History:** Students must be able to view a history of all programs they have attended.

#### 1.1.3 Contribution Management
*   **1.1.3.1 Submit Contributions:** Students must be able to submit claims for positions held in various programs for admin verification.
*   **1.1.3.2 Provide Evidence:** When submitting a contribution, a student must have the option to upload photographic evidence (e.g., a certificate or event photo).
*   **1.1.3.3 View Submission Status:** Students must be able to view the status (Pending, Approved, Rejected) of their submitted contributions.
*   **1.1.3.4 Handle Rejection:** If a submission is rejected, students must be able to see the admin's reason and have the ability to edit and resubmit their application.
*   **1.1.3.5 Export Records:** Students must be able to download a PDF document of their approved contributions.

### 1.2 Administrator User Requirements

#### 1.2.1 Dashboard & Analytics
*   **1.2.1.1 Dashboard Overview:** Admin must be able to view a summary of key system metrics, including Total Programs, Monthly Active Students, and New Student Growth.
*   **1.2.1.2 Recent Programs:** Admin must be able to view a list of the 5 most recently created programs for quick access.
*   **1.2.1.3 Contribution History:** Admin must be able to view, search (by Matric ID), and export a comprehensive list of all approved student contributions as a PDF.
*   **1.2.1.4 Delete Contribution:** Admin must have the ability to delete an approved contribution record from the history.
*   **1.2.1.5 Analytics:** Admin must be able to access a page containing an embedded Looker Studio dashboard for real-time program analytics.

#### 1.2.2 Program & Attendance Management
*   **1.2.2.1 Program Creation:** Admin must be able to create a new program, providing details like title, description, location, and the full schedule (start and end date/time).
*   **1.2.2.2 Program Configuration:** Admin must have full control over the public QR attendance form, including setting custom URL slugs, post-submission redirect URLs, and defining required fields.
*   **1.2.2.3 Check-out Window:** Admin must be able to configure a specific time window for when students are allowed to check out from a program.
*   **1.2.2.4 View All Programs:** Admin must be able to view a comprehensive, searchable list of all past, present, and future programs.
*   **1.2.2.5 Program Deletion:** Admin must be able to delete a program, which will cascade-delete all its associated data including attendance, configuration, and QR code links.
*   **1.2.2.6 View Attendance:** For any program, an admin must be able to view a paginated and searchable list of all attendees.
*   **1.2.2.7 Manual Attendance:** Admin must have the ability to manually add an attendance record for a student and to manually perform a check-out on their behalf.
*   **1.2.2.8 Export Attendance:** Admin must be able to export the attendance list for any given program in both CSV and PDF formats.

#### 1.2.3 User & Verification Management
*   **1.2.3.1 User Listing:** Admin must be able to view and search a paginated list of all registered users (students and other admins).
*   **1.2.3.2 User Profile Viewing:** Admin must be able to view the detailed profile of any user in the system.
*   **1.2.3.3 User Deletion:** Admin must be able to delete student user accounts. This action must trigger a full cleanup of the student's associated data.
*   **1.2.3.4 Verification Queue:** Admin must be able to view a paginated list of all student contribution applications that are pending verification.
*   **1.2.3.5 Evidence Review:** When reviewing an application, the admin must be able to view any uploaded image evidence in a modal or previewer.
*   **1.2.3.6 Approve/Reject:** Admin must be able to either approve or reject a pending application. A rejection must require a remark explaining the reason, which will be visible to the student.

#### 1.2.4 Admin Profile
*   **1.2.4.1 Profile Management:** Admin must be able to view their own profile and edit their personal information, such as their display name.


## 2.0 Functional Requirements

This section specifies what the system itself shall do to meet the user requirements.

### 2.1 Account & Authentication
*   **2.1.1** The system shall provide a user registration interface to create student or admin accounts.
*   **2.1.2** The system shall authenticate users via their email and password.
*   **2.1.3** The system shall assign a 'student' or 'admin' role to each user upon registration.
*   **2.1.4** The system shall enforce unique matriculation IDs during student registration.
*   **2.1.5** The system shall store user profile data, including name, email, role, and student-specific details (matric ID, course, phone number).
*   **2.1.6** The system shall restrict data modification access based on user roles (students can edit their own profile; admins can edit any).

### 2.2 Program & Attendance Management
*   **2.2.1** The system shall allow administrators to perform CRUD (Create, Read, Update, Delete) operations on program records.
*   **2.2.2** The system shall generate and store a unique, URL-friendly slug for each program to be used in a public QR link.
*   **2.2.3** The system shall provide a public-facing web form for each program to handle attendance check-ins.
*   **2.2.4** The system shall validate check-in times against a pre-configured time window for each program.
*   **2.2.5** The system shall record attendance submissions, linking them to a specific program and student email.
*   **2.2.6** The system shall allow students to record a check-out time, which is validated against a pre-configured check-out window.
*   **2.2.7** The system shall automatically calculate the attendance duration in minutes upon check-out.
*   **2.2.8** A scheduled function shall run periodically to identify attendance records that are missing a check-out and flag them with a `reminder` field.

### 2.3 Contribution & Verification
*   **2.3.1** The system shall provide an interface for students to submit contribution claims for program positions.
*   **2.3.2** The system shall support optional image file uploads (max 10MB) as evidence, storing the file in a secure storage bucket.
*   **2.3.3** The system shall set the status of new contribution claims to 'pending'.
*   **2.3.4** The system shall provide an administrative interface to display all 'pending' contribution claims in a paginated list.
*   **2.3.5** The system shall allow administrators to change the status of a claim to 'approved' or 'rejected'.
*   **2.3.6** If a claim is rejected, the system shall store a remark from the administrator, which shall be visible to the student.
*   **2.3.7** The system shall allow students to edit and resubmit claims that have a 'rejected' or 'pending' status.

### 2.4 Reporting & Data Export
*   **2.4.1** The system shall generate and display key metrics on the admin dashboard, including total programs and student activity counts.
*   **2.4.2** The system shall allow administrators to export program attendance lists in both CSV and PDF formats.
*   **2.4.3** The system shall allow both students and administrators to generate a PDF report of approved contributions. The admin report can be for all students or filtered by a specific student.

## 3.0 Non-Functional Requirements

### 3.1 Performance
*   **3.1.1 Real-Time Updates:** The system uses real-time listeners (Firestore onSnapshot) to ensure that data on dashboards and lists (such as attendance, verification queues) updates automatically without requiring a manual page refresh.
*   **3.1.2 Fast Page Loads:** Pages load quickly, achieved through Next.js server-side rendering and efficient client-side data fetching.
*   **3.1.3 Efficient Queries:** Backend queries are optimized. Pagination is implemented for all potentially large datasets (e.g., users, attendances, programs) to prevent fetching excessive data at once.

### 3.2 Scalability
*   **3.2.1 Cloud-Based Backend:** The system leverages Firebase services (Firestore, Auth, Storage, Functions), which are designed to scale automatically with user load.
*   **3.2.2 Paginated Data:** All lists that can grow indefinitely (e.g., user lists, program lists, attendance records) are paginated to ensure the application remains performant as data volume increases.

### 3.3 Usability
*   **3.3.1 Role-Based Interfaces:** The system provides distinct, intuitive user interfaces tailored to the roles of "Student" and "Admin".
*   **3.3.2 Responsive Design:** The user interface is fully responsive and functional across various devices, including desktops, tablets, and mobile phones.
*   **3.3.3 Clear Feedback:** The system provides immediate and clear feedback for user actions, such as success messages (toasts) for successful submissions and descriptive error messages for failures.

### 3.4 Reliability
*   **3.4.1 High Availability:** The system relies on Google Cloud's Firebase infrastructure, which provides high uptime and reliability.
*   **3.4.2 Error Handling:** The application gracefully handles errors (e.g., network failures, permission errors) and provides informative feedback to the user.

### 3.5 Maintainability
*   **3.5.1 Modular Architecture:** The frontend code is organized into a modular structure using reusable React components, hooks, and utility functions.
*   **3.5.2 Typed Codebase:** The project uses TypeScript to ensure type safety, reducing bugs and improving developer experience.
*   **3.5.3 Consistent Styling:** The UI is built using Tailwind CSS and ShadCN UI components, ensuring a consistent design system that is easy to maintain and extend.

## 4.0 Security Requirements

### 4.1 Authentication
*   **4.1.1 Secure Login:** All users must authenticate via a secure email and password mechanism provided by Firebase Authentication.
*   **4.1.2 Session Management:** User sessions are securely managed by the Firebase Authentication SDK.

### 4.2 Authorization & Access Control

The system's API is primarily defined by the client-side Firebase SDKs for Firestore, Authentication, and Storage. All data access is governed by a strict Role-Based Access Control (RBAC) model, which is enforced on the server-side by security rules (`firestore.rules` and `storage.rules`).

#### 4.2.1 Role Definitions
*   **Unauthenticated User:** Any visitor who is not logged in.
*   **Student:** An authenticated user with the `student` role.
*   **Administrator (Admin):** An authenticated user with the `admin` role.

#### 4.2.2 User Control Matrix (Firestore)

The following matrix details the permissions for each major data entity in Firestore:

| Collection Path                                | Action          | Unauthenticated | Student (Owner) | Student (Other) | Admin     | Notes                                                              |
| ---------------------------------------------- | --------------- | --------------- | --------------- | --------------- | --------- | ------------------------------------------------------------------ |
| `/users/{userId}`                              | **Read (Get)**  | Deny            | Allow           | Deny            | Allow     | Admins can view any profile, students only their own.              |
|                                                | **List**        | Deny            | Deny            | Deny            | Allow     | Only admins can list all users.                                    |
|                                                | **Create**      | Deny            | Allow           | Deny            | (Allow)   | Users create their own profile on sign-up.                         |
|                                                | **Update**      | Deny            | Allow           | Deny            | Allow     | Students can edit their own profile.                               |
|                                                | **Delete**      | Deny            | Deny            | Deny            | Allow     | Only admins can delete user accounts.                              |
| `/users/{userId}/positions/{positionId}`       | **Read/List**   | Deny            | Allow           | Deny            | Allow     | Students see their own submissions; admins see all.                |
|                                                | **Create**      | Deny            | Allow           | Deny            | Deny      | Student must have a complete profile. Status must be `pending`.    |
|                                                | **Update**      | Deny            | Allow           | Deny            | Allow     | Student can only edit if status is `pending` or `rejected`.        |
|                                                | **Delete**      | Deny            | Allow           | Deny            | Allow     |                                                                    |
| `/programs/{programId}`                        | **Read (Get)**  | Allow           | Allow           | Allow           | Allow     | Publicly readable for QR form pages.                               |
|                                                | **List**        | Deny            | Allow           | Allow           | Allow     | Any authenticated user can list programs.                          |
|                                                | **Create/Update/Delete** | Deny            | Deny            | Deny            | Allow     | Only admins can manage programs.                                   |
| `/programs/{programId}/attendances/{attendanceId}` | **Read (Get)**  | Deny            | Allow           | Deny            | Allow     | Student can read their own attendance (doc ID is their email).     |
|                                                | **Create**      | Allow           | Allow           | Allow           | Allow     | Open to public for check-in via QR form.                           |
|                                                | **Update**      | Deny            | Allow           | Deny            | Allow     | Limited to check-out fields (`checkOutAt`, `duration`, `status`).  |
|                                                | **Delete**      | Deny            | Deny            | Deny            | Allow     | Only admins can delete attendance records.                         |
| `/qrSlugs/{slug}`                              | **Read (Get)**  | Allow           | Allow           | Allow           | Allow     | Publicly readable to map QR code to program.                       |
|                                                | **Write**       | Deny            | Deny            | Deny            | Allow     | Only admins can create/update slugs.                               |
| `/matricIds/{matricId}`                        | **Read (Get)**  | Allow           | Allow           | Allow           | Allow     | Publicly readable to check for uniqueness on registration.         |
|                                                | **Create**      | Deny            | Allow           | Deny            | (Allow)   | Created atomically during user registration.                       |

#### 4.2.3 User Control (Storage)

File uploads are governed by `storage.rules`:

| Storage Path                               | Action | Unauthenticated | Student (Owner) | Admin | Notes                                                    |
| ------------------------------------------ | ------ | --------------- | --------------- | ----- | -------------------------------------------------------- |
| `/contributions/{userId}/{posId}/{file}` | **Read**   | Allow           | Allow           | Allow | Anyone with the link can read.                           |
|                                            | **Create** | Deny            | Allow           | Allow | Max 10MB image files (`image/*`).                          |
|                                            | **Update** | Deny            | Deny            | Deny  | Prevents evidence from being changed after submission.   |
|                                            | **Delete** | Deny            | Allow           | Allow | The owner or an admin can delete the file.             |


### 4.3 Data Integrity
*   **4.3.1 Input Validation:** All user input is validated on the client-side using Zod schemas to ensure data correctness before submission.
*   **4.3.2 Server-Side Validation:** Firestore security rules provide a second layer of server-side validation to ensure that only properly structured and valid data can be written to the database.
*   **4.3.3 Unique Constraints:** Uniqueness for critical fields like matriculation IDs is enforced through a dedicated Firestore collection (`/matricIds/{matricId}`) and security rules that prevent overwrites.

### 4.4 Data Protection
*   **4.4.1 Secure Data Transmission:** All data exchanged between the client and Firebase services is encrypted in transit using HTTPS.
*   **4.4.2 Secure File Storage:** Uploaded files (e.g., contribution evidence) are stored in Firebase Storage. Access is controlled by Storage Security Rules (`storage.rules`), which restrict who can upload, view, and delete files based on their user ID.
*   **4.4.3 Data Cleanup:** When a user account is deleted, a Cloud Function (`onUserDeleted`) is triggered to perform a full cleanup of all associated user data, including their contributions, attendance records, and unique matric ID reservation, to prevent orphaned data.
