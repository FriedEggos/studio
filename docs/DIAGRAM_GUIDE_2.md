# Guide to Creating a Use Case Diagram & ERD for JTMK+

This document provides a guide to creating a Use Case Diagram and an Entity Relationship Diagram (ERD) for your JTMK+ system.

## 1. Use Case Diagram

A Use Case Diagram shows how users (actors) interact with the system to achieve their goals. It's great for understanding the functional requirements from a user's perspective.

### Step 1: Identify Actors

The actors are the users or external systems that interact with JTMK+.
1.  **Student**: The primary user who participates in programs and manages their contributions.
2.  **Administrator**: The user who manages the entire system.

### Step 2: Identify Use Cases

Use cases represent the actions or goals the actors can achieve.

#### Student Use Cases:
*   Register for Account
*   Log In / Log Out
*   View Dashboard
*   Manage Profile (View/Edit)
*   Submit Contribution Claim
    *   *<<include>>* Upload Evidence (Optional)
*   View Contribution Status
*   Edit/Resubmit Contribution
*   Delete Contribution
*   Download Contribution PDF
*   Check-in to Program (via QR)
*   Check-out from Program

#### Administrator Use Cases:
*   Log In / Log Out
*   View Admin Dashboard
*   Manage Programs (Create, Read, Update, Delete)
*   View Program Attendance
*   Manage Users (View List, View Profile, Delete User)
*   Manage Verifications (View Queue, Approve/Reject Claims)
*   Manage Profile (View/Edit)
*   View Analytics
*   Export Reports (PDF/CSV)
*   Manually Add/Checkout Attendance

### Step 3: Draw the Diagram

1.  **System Boundary**: Draw a large rectangle and label it "JTMK+ System".
2.  **Actors**: Place the **Student** and **Administrator** actors (as stick figures) outside the rectangle.
3.  **Use Cases**: Place the use cases (as ovals) inside the system boundary rectangle.
4.  **Associations**: Draw solid lines connecting actors to the use cases they interact with. For example, connect **Student** to "Submit Contribution Claim" and **Administrator** to "Manage Programs".
5.  **Relationships (Optional but helpful)**:
    *   Use `<<include>>` for functionality that is required by another use case (e.g., "Log In" might be included by many others).
    *   Use `<<extend>>` for optional functionality (e.g., "Submit Contribution Claim" could be extended by "Upload Evidence").

---

## 2. Entity Relationship Diagram (ERD)

An ERD shows the relationships between different data entities in your database. It's a blueprint for your Firestore data structure.

### Step 1: Identify Entities

These are the main data objects in your system, which correspond to your Firestore collections.
*   **User**: Stores profile data for students and admins.
*   **Program**: Stores details for all events.
*   **Position**: Stores contribution claims made by students.
*   **Attendance**: Stores individual attendance records for a program.
*   **ProgramConfig**: Stores the QR form settings for a program.
*   **QrSlug**: Maps a URL slug to a program ID.
*   **MatricId**: Ensures uniqueness of student matriculation IDs.

### Step 2: Identify Attributes

These are the properties of each entity, corresponding to the fields in your Firestore documents. The primary key (PK) uniquely identifies each record.

*   **User**
    *   `userId` (PK)
    *   `displayName`
    *   `email`
    *   `role`
    *   `matricId`
    *   `course`
    *   `photoURL`, etc.
*   **Program**
    *   `programId` (PK)
    *   `title`
    *   `description`
    *   `startDateTime`
    *   `qrSlug`, etc.
*   **Position** (Weak entity, depends on User)
    *   `positionId` (PK)
    *   `programName`
    *   `verificationStatus`, etc.
*   **Attendance** (Weak entity, depends on Program)
    *   `attendanceId` (PK, which is the user's email)
    *   `studentName`
    *   `createdAt` (Check-in time), etc.

### Step 3: Identify Relationships and Cardinality

This defines how entities are connected. (Using Crow's Foot Notation: `|` is one, `O` is zero, ` crows foot ` is many)

*   A **User** (if student) `submits` zero or many **Positions**.
    *   `User` |<---|| `Position` (One-to-Many)
*   A **User** (if admin) `creates` zero or many **Programs**.
    *   `User` |<---|| `Program` (One-to-Many)
*   A **Program** `has` one and only one **ProgramConfig**.
    *   `Program` ||---|| `ProgramConfig` (One-to-One)
*   A **Program** `has` zero or many **Attendance** records.
    *   `Program` |<---|| `Attendance` (One-to-Many)
*   A **Program** `is mapped by` one and only one **QrSlug**.
    *   `Program` ||---|| `QrSlug` (One-to-One)
*   A **User** (if student) `claims` one and only one **MatricId**.
    *   `User` ||---|| `MatricId` (One-to-One)

### Step 4: Draw the Diagram

1.  **Entities**: Draw each entity as a rectangle with its name at the top.
2.  **Attributes**: List the attributes inside the entity rectangle. Underline the primary key.
3.  **Relationships**: Draw lines connecting related entities. Use crow's foot notation on the ends of the lines to show cardinality (e.g., the "many" side gets the crow's foot). You can add a verb phrase to the line to describe the relationship (e.g., "submits").

### Recommended Tools

To draw these diagrams, you can use free online tools like:
*   **diagrams.net** (formerly draw.io)
*   **Lucidchart** (has a free tier)
*   **Miro** (has a free tier)
