
import type { Timestamp } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  plan: "free"; // For now, only "free" plan
  dailyRemainingQuota: number;
  lastSummaryDate: Timestamp | string | null; // Store as Firestore Timestamp, allow string for new objects before conversion
}

export interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin?: boolean; // Example, if you have admin roles
}
