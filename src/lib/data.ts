export const programs = [
    { id: '1', name: 'Advanced Web Development Workshop', startDate: '2024-07-22', endDate: '2024-07-28', description: 'Master the latest web development techniques with industry experts.', imageId: 'program-1' },
    { id: '2', name: 'National Cybersecurity Seminar', startDate: '2024-11-02', endDate: '2024-11-03', description: 'Understand an cyber threats and how to protect against them.', imageId: 'program-2' },
    { id: '3', name: 'Pesta Niaga', startDate: '2026-02-02', endDate: '2026-02-04', description: 'Connect with leading technology companies.', imageId: 'program-3' },
  ];

  // This list will now be populated when a student joins a program from the dashboard.
  export const myPrograms: any[] = [];
  
  export const participationHistory = [
    { programName: 'Basic Photoshop Course', date: '2024-05-20', status: 'Approved', certificateUrl: '#' },
    { programName: 'Digital Innovation Competition', date: '2024-04-11', status: 'Approved', certificateUrl: '#' },
    { programName: 'IT Career Talk', date: '2024-03-18', status: 'Pending Verification', certificateUrl: null },
  ];
  
  export const pendingVerifications = [
      { id: 'v1', studentName: 'Ahmad bin Ali', programName: 'Advanced Web Development Workshop', submissionDate: '2024-08-16' },
      { id: 'v2', studentName: 'Siti Nurhaliza', programName: 'National Cybersecurity Seminar', submissionDate: '2024-09-03' },
      { id: 'v3', studentName: 'John Doe', programName: 'Advanced Web Development Workshop', submissionDate: '2024-08-17' },
  ]
  
  export const allProgramsAdmin = [
      { id: 'p1', name: 'Advanced Web Development Workshop', participants: 45, status: 'Completed' },
      { id: 'p2', name: 'National Cybersecurity Seminar', participants: 120, status: 'Upcoming' },
      { id: 'p3', name: 'Pesta Niaga', participants: 78, status: 'Upcoming' },
      { id: 'p4', name: 'Basic Photoshop Course', participants: 30, status: 'Completed' },
  ]
  