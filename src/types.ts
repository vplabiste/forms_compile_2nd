export type UserRole = 'Employee' | 'Manager' | 'Admin';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  initials: string;
  initialsConfirmed?: boolean;
  password?: string;
}

export interface FormRecord {
  id: string;
  originalName: string;
  systemName: string;
  cloudinaryUrl: string;
  comments: string;
  uploaderId: string;
  uploaderInitials: string;
  formInitials: string;
  sequenceNumber: number;
  createdAt: any; // Firestore Timestamp
  archived?: boolean;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  initials: string;
  description: string;
  published: boolean;
  createdAt: any;
  creatorId: string;
  creatorName: string;
}

export interface ActivityLog {
  id: string;
  action: 'Upload' | 'Download' | 'Delete' | 'Archive' | 'Restore';
  performedBy: string; // name or email
  performedByRole: string; // Employee or Manager or Admin
  details: string; // Specific details about the file(s)
  createdAt: any; // Firestore Timestamp
}


