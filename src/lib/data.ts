export const programs: any[] = [];

  // This list will now be populated when a student joins a program from the dashboard.
  export const myPrograms: any[] = [];
  
  export const participationHistory = [
    { programName: 'Basic Photoshop Course', date: '2024-05-20', status: 'Approved', certificateUrl: '#' },
    { programName: 'Digital Innovation Competition', date: '2024-04-11', status: 'Approved', certificateUrl: '#' },
    { programName: 'IT Career Talk', date: '2024-03-18', status: 'Pending Verification', certificateUrl: null },
  ];
  
  export const pendingVerifications = [
      { id: 'v1', studentName: 'Ahmad bin Ali', programName: 'Advanced Web Development Workshop', submissionDate: '2024-08-16', imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwyfHxldmVudCUyMHBob3RvfGVufDB8fHx8MTc2ODc5NjQyN3ww&ixlib=rb-4.1.0&q=80&w=1080' },
      { id: 'v2', studentName: 'Siti Nurhaliza', programName: 'National Cybersecurity Seminar', submissionDate: '2024-09-03', imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwzfHxldmVudCUyMHBob3RvfGVufDB8fHx8MTc2ODc5NjQyN3ww&ixlib=rb-4.1.0&q=80&w=1080' },
      { id: 'v3', studentName: 'John Doe', programName: 'Advanced Web Development Workshop', submissionDate: '2024-08-17', imageUrl: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw1fHxldmVudCUyMHBob3RvfGVufDB8fHx8MTc2ODc5NjQyN3ww&ixlib=rb-4.1.0&q=80&w=1080' },
  ]
  
  export const allProgramsAdmin = [
      { id: 'p1', name: 'Advanced Web Development Workshop', participants: 45, status: 'Completed' },
      { id: 'p2', name: 'National Cybersecurity Seminar', participants: 120, status: 'Upcoming' },
      { id: 'p3', name: 'Pesta Niaga', participants: 78, status: 'Upcoming' },
      { id: 'p4', name: 'Basic Photoshop Course', participants: 30, status: 'Completed' },
  ]
  
