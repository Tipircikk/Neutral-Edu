
import type { Timestamp } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  plan: "free" | "premium" | "pro";
  dailyRemainingQuota: number;
  lastSummaryDate: Timestamp | string | null; // Can be string from older data, ensure conversion
  isAdmin?: boolean;
  planExpiryDate?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin?: boolean;
}

export type SupportTicketStatus = "open" | "answered" | "closed_by_user" | "closed_by_admin";
export type SupportTicketSubject = "premium" | "ai_tools" | "account" | "bug_report" | "other";

// Updated SupportTicket structure
export interface SupportTicket {
  id: string; // Firestore document ID
  userId: string;
  userEmail: string | null;
  userName?: string | null;
  subject: SupportTicketSubject;
  status: SupportTicketStatus;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  lastMessageSnippet?: string; // Snippet of the last message
  lastMessageAt?: Timestamp;   // Timestamp of the last message
  lastRepliedByAdmin?: boolean; // True if the last message was from an admin
  // adminReply, repliedBy are removed as messages will be in subcollection
}

export interface SupportMessage {
  id?: string; // Firestore document ID for the message
  senderId: string; // UID of user or admin
  senderType: "user" | "admin";
  senderName: string; // Display name of sender or "Destek Ekibi"
  text: string;
  timestamp: Timestamp;
}

export interface PricingConfig {
  premium?: { price: string };
  pro?: { price: string };
  updatedAt?: Timestamp;
}
