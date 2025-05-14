
import type { Timestamp } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  plan: "free" | "premium";
  dailyRemainingQuota: number;
  lastSummaryDate: Timestamp | string | null; 
  isAdmin?: boolean; 
  // Optional: Add fields for tracking total summaries made for more detailed admin views
  // totalSummariesMade?: number; 
}

export interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin?: boolean; 
}

export type SupportTicketStatus = "open" | "answered" | "closed_by_user" | "closed_by_admin";
export type SupportTicketSubject = "premium" | "ai_tools" | "account" | "bug_report" | "other";

export interface SupportTicket {
  id?: string; // Firestore document ID
  userId: string;
  userEmail: string | null;
  userName?: string | null;
  subject: SupportTicketSubject;
  message: string;
  status: SupportTicketStatus;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  adminReply?: string;
  repliedBy?: string; // Admin UID
  lastReplyAt?: Timestamp;
}
