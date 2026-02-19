export const programs = [
    { id: '1', name: 'Advanced Web Development Workshop', startDate: '2024-07-22', endDate: '2024-07-28', briefDescription: 'Master the latest web development techniques with industry experts.', description: 'This intensive 5-day workshop will cover everything from advanced React hooks and state management to Next.js server components and deployment strategies. Suitable for developers with intermediate experience.', imageId: 'program-1' },
    { id: '2', name: 'National Cybersecurity Seminar', startDate: '2024-11-02', endDate: '2024-11-03', briefDescription: 'Understand and protect against modern cyber threats.', description: 'Join us for a two-day seminar featuring keynote speakers from the cybersecurity industry. Topics include ethical hacking, network security, and data protection regulations.', imageId: 'program-2' },
    { id: '3', name: 'Pesta Niaga', startDate: '2026-02-02', endDate: '2026-02-04', briefDescription: 'Connect with leading technology companies and discover career opportunities.', description: 'Our annual career fair is back! Meet recruiters from top tech firms, attend career talks, and get your resume reviewed by professionals. Open to all JTMK students.', imageId: 'program-3' },
  ];

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
  
