export interface EventItem {
  id: string;
  slug: string;
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
  date: string;
  time: string;
  locationEn: string;
  locationBn: string;
  category: 'Workshop' | 'Summit' | 'Hackathon' | 'Leadership' | 'Community' | 'Civic Action';
  capacity: number;
  currentRegistrations: number;
  sheetTabName: string;
  imageBg: string;
  accentColor: string;
  organizer: string;
  isPaid?: boolean;
  price?: number; // e.g. 500 BDT or 0
  paymentInstructions?: string;
  whatsappGroupLink?: string;
}

export interface RegistrationRecord {
  id: string; // e.g., SP-1001
  eventId: string;
  eventTitle: string;
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  youthGroup: string;
  age: number;
  emergencyContact: string;
  status: 'Confirmed' | 'Pending' | 'Waitlist' | 'Registered';
  registeredAt: string;
  qrPayload: string;
  syncedToGoogleSheets: boolean;
  isPaidEvent?: boolean;
  paymentAmount?: number;
  transactionId?: string;
  paymentMethod?: string; // 'bKash' | 'Nagad' | 'Rocket' | 'Bank'
  paymentStatus?: 'Completed' | 'Pending Verification' | 'N/A';
  emailSent?: boolean;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  phone: string;
  address: string;
  organization: string;
  role: 'admin' | 'organizer' | 'attendee';
  createdAt: string;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  phone?: string;
  address?: string;
  organization?: string;
  role: 'admin' | 'organizer' | 'attendee';
}

export interface SupportTicketRecord {
  id: string;
  fullName: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: string;
  status: 'Open' | 'Resolved' | 'Pending';
  syncedToGoogleSheets: boolean;
}

export interface GoogleSheetsConfig {
  spreadsheetId?: string;
  clientEmail?: string;
  hasPrivateKey?: boolean;
  isConnected: boolean;
  mode: 'live' | 'mock_persisted';
  lastSyncedAt?: string;
}
