# Guide to Creating a Context Diagram & Data Flow Diagram (DFD) for JTMK+

This document provides a step-by-step guide to creating a Context Diagram and a Data Flow Diagram (DFD) for your JTMK+ system.

## 1. Context Diagram (Level 0 DFD)

The Context Diagram is a high-level view that shows how your system interacts with external entities. It has one central process bubble representing your entire system and shows the data that flows between the system and these external entities.

### Step 1: Identify External Entities

Your JTMK+ system interacts with the following external entities:
1.  **Student**: The primary user who participates in programs and submits contributions.
2.  **Administrator**: The user who manages the system, programs, users, and verifications.
3.  **Email System (Nodemailer/Gmail)**: An external service used to send email notifications.

### Step 2: Identify Data Flows

Here are the data flows between the entities and your central "JTMK+ System" process bubble:

*   **From Student to System:**
    *   `Login Credentials`
    *   `Registration Details` (Name, Matric ID, etc.)
    *   `Profile Updates`
    *   `Contribution Claim` (Program name, position, evidence file)
    *   `Check-in / Check-out Actions`

*   **From System to Student:**
    *   `Dashboard View` (List of programs)
    *   `Profile Information`
    *   `Contribution Status` (Pending, Approved, Rejected)
    *   `PDF of Approved Contributions`
    *   `Check-in/Check-out Confirmation Emails`
    *   `Verification Result Emails` (via Email System)

*   **From Administrator to System:**
    *   `Login Credentials`
    *   `New Program Details`
    *   `Program Updates / Deletion Commands`
    *   `User Management Actions` (View, Delete)
    *   `Contribution Verification Decision` (Approve/Reject)
    *   `Manual Attendance Data`

*   **From System to Administrator:**
    *   `Admin Dashboard View` (Stats, Program Lists, History)
    *   `User Lists & Profiles`
    *   `Program Attendance Lists`
    *   `Pending Verification Queue`
    *   `Contribution Evidence` (Image for review)
    *   `Exported Data` (PDF/CSV reports)

*   **From System to Email System:**
    *   `Email Send Request` (Recipient, Subject, Body)

### Diagram Example (Text Description)

Imagine a central circle labeled **"JTMK+ System"**. Around it, you'll have three boxes: **Student**, **Administrator**, and **Email System**. Arrows show the data flows listed above. For example, an arrow from **Student** to the central circle is labeled `Registration Details`, and an arrow from the central circle to **Student** is labeled `Dashboard View`.

---

## 2. Data Flow Diagram (Level 1)

The Level 1 DFD breaks down the central "JTMK+ System" bubble into its main processes. It shows how data flows between these processes and to/from data stores and external entities.

### Step 1: Identify Key Processes

Based on your website's functionality, the main processes are:
*   **1.0 Manage Users & Auth**: Handles registration, login, and profile management.
*   **2.0 Manage Programs**: Handles creating, updating, deleting, and viewing programs.
*   **3.0 Handle Attendance**: Manages student check-ins and check-outs via the QR form.
*   **4.0 Manage Contributions**: Handles the submission and verification of student positions.
*   **5.0 Generate Reports**: Creates and exports PDF/CSV files.
*   **6.0 Send Notifications**: Interfaces with the email system.

### Step 2: Identify Data Stores

Your system uses Firebase, which provides the following data stores:
*   **D1: Users** (Firestore Collection: `/users`)
*   **D2: Programs** (Firestore Collection: `/programs`, `/programConfigs`, `/qrSlugs`)
*   **D3: Attendances** (Firestore Sub-collection: `/programs/{programId}/attendances`)
*   **D4: Contributions** (Firestore Sub-collection: `/users/{userId}/positions`)
*   **D5: Matric IDs** (Firestore Collection: `/matricIds` for uniqueness)
*   **D6: Contribution Files** (Firebase Storage Bucket)

### Step 3: Map Data Flows Between Components

Here’s how data moves between the entities, processes, and data stores:

#### Registration & Login Flow
1.  **Student** (Entity) -> `Registration Details` -> **1.0 Manage Users & Auth** (Process)
2.  **1.0 Manage Users & Auth** -> `Check Uniqueness` -> **D5: Matric IDs** (Data Store)
3.  **1.0 Manage Users & Auth** -> `New User Data` -> **D1: Users** (Data Store)
4.  **1.0 Manage Users & Auth** -> `Claim Matric ID` -> **D5: Matric IDs** (Data Store)
5.  **Student/Admin** (Entity) -> `Login Credentials` -> **1.0 Manage Users & Auth**
6.  **1.0 Manage Users & Auth** -> `User Role/Profile` -> **D1: Users**
7.  **1.0 Manage Users & Auth** -> `Login Success/Failure` -> **Student/Admin**

#### Program Management Flow (Admin)
1.  **Administrator** (Entity) -> `New Program Data` -> **2.0 Manage Programs** (Process)
2.  **2.0 Manage Programs** -> `Program & Config Data` -> **D2: Programs** (Data Store)
3.  **Administrator** -> `Request Program List` -> **2.0 Manage Programs**
4.  **2.0 Manage Programs** -> `Program List` -> **D2: Programs**
5.  **2.0 Manage Programs** -> `Display Program List` -> **Administrator**

#### Attendance Flow (Student & Admin)
1.  **Student** (Entity) -> `QR Scan` -> `Program & Form Details` -> **D2: Programs** (Data Store)
2.  **Student** -> `Check-in Submission` -> **3.0 Handle Attendance** (Process)
3.  **3.0 Handle Attendance** -> `New Attendance Record` -> **D3: Attendances** (Data Store)
4.  **3.0 Handle Attendance** -> `Send Email Request` -> **6.0 Send Notifications** (Process)
5.  **6.0 Send Notifications** -> `Email Content` -> **Email System** (Entity)
6.  **Administrator** -> `Request Attendance List` -> **3.0 Handle Attendance**
7.  **3.0 Handle Attendance** -> `Attendance List` -> **D3: Attendances**

#### Contribution Flow (Student & Admin)
1.  **Student** (Entity) -> `Contribution Submission` (with optional file) -> **4.0 Manage Contributions** (Process)
2.  **4.0 Manage Contributions** -> `Evidence File` -> **D6: Contribution Files** (Data Store)
3.  **4.0 Manage Contributions** -> `Contribution Data` (with file URL) -> **D4: Contributions** (Data Store)
4.  **Administrator** -> `Request Pending List` -> **4.0 Manage Contributions**
5.  **4.0 Manage Contributions** -> `Pending Contributions` -> **D4: Contributions**
6.  **4.0 Manage Contributions** -> `Evidence File URL` -> **D6: Contribution Files**
7.  **4.0 Manage Contributions** -> `Display Application & Evidence` -> **Administrator**
8.  **Administrator** -> `Verification Decision` (Approve/Reject) -> **4.0 Manage Contributions**
9.  **4.0 Manage Contributions** -> `Updated Status` -> **D4: Contributions**

#### Reporting Flow
1.  **Administrator/Student** (Entity) -> `Request PDF/CSV Export` -> **5.0 Generate Reports** (Process)
2.  **5.0 Generate Reports** -> `Approved Contributions / Attendance Data` -> **D3: Attendances** & **D4: Contributions**
3.  **5.0 Generate Reports** -> `Generated Report File` -> **Administrator/Student**

## 3. Recommended Tools

To draw these diagrams, you can use free online tools like:
*   **diagrams.net** (formerly draw.io)
*   **Lucidchart** (has a free tier)
*   **Miro** (has a free tier)

Use the components (circles for processes, rectangles for entities, open-ended rectangles for data stores, and arrows for data flows) to visually represent the steps outlined above.