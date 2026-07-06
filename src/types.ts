export type UserRole = 'Employee' | 'Manager' | 'Admin';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  initials: string;
  initialsConfirmed?: boolean;
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

