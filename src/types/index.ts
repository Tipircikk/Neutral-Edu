
import type { Timestamp } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  plan: "free" | "premium" | "pro";
  dailyRemainingQuota: number;
  lastSummaryDate: Timestamp | string | null;
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

export interface SupportMessage {
  id?: string;
  senderId: string;
  senderType: "user" | "admin";
  senderName: string;
  text: string;
  timestamp: Timestamp;
}
export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string | null;
  userName?: string | null;
  userPlan?: UserProfile["plan"];
  subject: SupportTicketSubject;
  status: SupportTicketStatus;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  lastMessageSnippet?: string;
  lastMessageAt?: Timestamp;
  lastRepliedByAdmin?: boolean;
  messages?: SupportMessage[]; // For holding messages when fetched
}


export interface PricingPlanDetails {
  price: string;
  originalPrice?: string;
}

export interface PricingConfig {
  premium?: PricingPlanDetails;
  pro?: PricingPlanDetails;
  updatedAt?: Timestamp;
}

export interface ExamDatesConfig {
  tytDate?: string; // Store as YYYY-MM-DD string
  aytDate?: string; // Store as YYYY-MM-DD string
  updatedAt?: Timestamp;
}

export interface Goal {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number; // Timestamp (Date.now())
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  createdAt: Timestamp;
  read: boolean;
  link?: string;
}

export interface CouponCode {
  id: string; // The actual code string, e.g., "PRO30DAYS2024". This will be the document ID.
  planApplied: "premium" | "pro"; // Which plan this coupon grants
  durationDays: number; // For how many days the plan is granted (e.g., 30, 90)
  usageLimit: number; // How many unique users can redeem this code
  timesUsed: number; // How many times this code has been redeemed
  isActive: boolean; // Whether the code can still be used (can be deactivated by admin)
  createdByAdminId: string;
  createdByAdminEmail?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // expiresAt?: Timestamp | null; // Optional: if the code itself has an expiry date for redemption
  // redeemedBy?: { userId: string, redeemedAt: Timestamp }[]; // Optional: to track who redeemed and when
}
