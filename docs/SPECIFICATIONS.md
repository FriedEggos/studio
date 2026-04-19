# System Requirement Specification

## 1.0 Introduction
This document outlines the functional requirements for the JTMK+ System, a QR-based program participation and committee role verification system.

## 2.0 Functional Requirements

### 2.1 Student User Requirements

#### 2.1.1 Account & Profile
*   **2.1.1.1 Registration & Access:** Users must be able to create an account and log in securely to access their personal records.
*   **2.1.1.2 Profile Management:** Students must be able to view and edit their profile information, including their full name, matric ID, phone number, and department.

#### 2.1.2 Program Participation
*   **2.1.2.1 View Programs:** Students must be able to view a dashboard of all ongoing, upcoming, and completed programs.
*   **2.1.2.2 Check-in:** Students must be able to check into a program by scanning a QR code which leads to a public attendance form.
*   **2.1.2.3 Check-out:** Students must be able to check out from a program to complete their attendance record.
*   **2.1.2.4 View Participation History:** Students must be able to view a history of all programs they have attended.

#### 2.1.3 Contribution Management
*   **2.1.3.1 Submit Contributions:** Students must be able to submit claims for positions held in various programs for admin verification.
*   **2.1.3.2 Provide Evidence:** When submitting a contribution, a student must have the option to upload photographic evidence (e.g., a certificate or event photo).
*   **2.1.3.3 View Submission Status:** Students must be able to view the status (Pending, Approved, Rejected) of their submitted contributions.
*   **2.1.3.4 Handle Rejection:** If a submission is rejected, students must be able to see the admin's reason and have the ability to edit and resubmit their application.
*   **2.1.3.5 Export Records:** Students must be able to download a PDF document of their approved contributions.

---

### 2.2 Administrator User Requirements

#### 2.2.1 Dashboard & Analytics
*   **2.2.1.1 Dashboard Overview:** Admin must be able to view a summary of key system metrics, including Total Programs, Monthly Active Students, and New Student Growth.
*   **2.2.1.2 Recent Programs:** Admin must be able to view a list of the 5 most recently created programs for quick access.
*   **2.2.1.3 Contribution History:** Admin must be able to view, search (by Matric ID), and export a comprehensive list of all approved student contributions as a PDF.
*   **2.2.1.4 Delete Contribution:** Admin must have the ability to delete an approved contribution record from the history.
*   **2.2.1.5 Analytics:** Admin must be able to access a page containing an embedded Looker Studio dashboard for real-time program analytics.

#### 2.2.2 Program & Attendance Management
*   **2.2.2.1 Program Creation:** Admin must be able to create a new program, providing details like title, description, location, and the full schedule (start and end date/time).
*   **2.2.2.2 Program Configuration:** Admin must have full control over the public QR attendance form, including setting custom URL slugs, post-submission redirect URLs, and defining required fields (e.g., Student ID, custom inputs).
*   **2.2.2.3 Check-out Window:** Admin must be able to configure a specific time window for when students are allowed to check out from a program.
*   **2.2.2.4 View All Programs:** Admin must be able to view a comprehensive, searchable list of all past, present, and future programs.
*   **2.2.2.5 Program Deletion:** Admin must be able to delete a program, which will cascade-delete all its associated data including attendance, configuration, and QR code links.
*   **2.2.2.6 View Attendance:** For any program, an admin must be able to view a paginated and searchable list of all attendees.
*   **2.2.2.7 Manual Attendance:** Admin must have the ability to manually add an attendance record for a student and to manually perform a check-out on their behalf.
*   **2.2.2.8 Export Attendance:** Admin must be able to export the attendance list for any given program in both CSV and PDF formats.

#### 2.2.3 User & Verification Management
*   **2.2.3.1 User Listing:** Admin must be able to view and search a paginated list of all registered users (students and other admins).
*   **2.2.3.2 User Profile Viewing:** Admin must be able to view the detailed profile of any user in the system.
*   **2.2.3.3 User Deletion:** Admin must be able to delete student user accounts. This action must trigger a full cleanup of the student's associated data.
*   **2.2.3.4 Verification Queue:** Admin must be able to view a paginated list of all student contribution applications that are pending verification.
*   **2.2.3.5 Evidence Review:** When reviewing an application, the admin must be able to view any uploaded image evidence in a modal or previewer.
*   **2.2.3.6 Approve/Reject:** Admin must be able to either approve or reject a pending application. A rejection must require a remark explaining the reason, which will be visible to the student.

#### 2.2.4 Admin Profile
*   **2.2.4.1 Profile Management:** Admin must be able to view their own profile and edit their personal information, such as their display name.
