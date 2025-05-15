
// This file is for defining types used within Firebase Functions.
// It's good practice to keep them consistent with your main app's types.
// For simplicity in this example, you might copy relevant parts from `src/types/index.ts`
// or set up a shared types package if your project grows.

import type { Timestamp } from "firebase-admin/firestore"; // Import from firebase-admin for functions

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  plan: "free" | "premium" | "pro";
  dailyRemainingQuota: number;
  lastSummaryDate?: Timestamp | null; // Firestore Timestamp from firebase-admin
  isAdmin?: boolean;
  planExpiryDate?: Timestamp | null; // Firestore Timestamp from firebase-admin
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// You can add other types like SupportTicket, SupportMessage if your functions interact with them.
