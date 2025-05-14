
import type { Timestamp } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  plan: "free" | "premium"; // Updated to include premium
  dailyRemainingQuota: number;
  lastSummaryDate: Timestamp | string | null; // Store as Firestore Timestamp, allow string for new objects before conversion
  isAdmin?: boolean; // Added for admin role
}

export interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin?: boolean; // Corresponds to userProfile.isAdmin, primary source is userProfile
}
