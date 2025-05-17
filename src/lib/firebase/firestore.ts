
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "./config";
import type { UserProfile } from "@/types";

const FREE_PLAN_DAILY_QUOTA = 2;
const PREMIUM_PLAN_DAILY_QUOTA = 10;
const PRO_PLAN_DAILY_QUOTA = 25;

export const createUserDocument = async (
  uid: string,
  email: string | null,
  displayName?: string | null
): Promise<UserProfile> => {
  const userRef = doc(db, "users", uid);
  const userProfile: UserProfile = {
    uid,
    email,
    displayName: displayName || email?.split('@')[0] || "User",
    plan: "free", // Default to free plan
    dailyRemainingQuota: FREE_PLAN_DAILY_QUOTA,
    lastSummaryDate: null, // Will be set on first summary or quota check
    isAdmin: false, // Default isAdmin to false
    planExpiryDate: null, // Initialize with null
  };
  await setDoc(userRef, { ...userProfile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return userProfile;
};

export const getUserProfile = async (uid:string): Promise<UserProfile | null> => {
  const userRef = doc(db, "users", uid);
  const docSnap = await getDoc(userRef);
  if (docSnap.exists()) {
    const data = docSnap.data() as UserProfile;
    
    // Ensure lastSummaryDate is a Firestore Timestamp or null
    if (data.lastSummaryDate && !(data.lastSummaryDate instanceof Timestamp) && typeof data.lastSummaryDate === 'object' && 'seconds' in data.lastSummaryDate && 'nanoseconds' in data.lastSummaryDate) {
        data.lastSummaryDate = new Timestamp((data.lastSummaryDate as any).seconds, (data.lastSummaryDate as any).nanoseconds);
    } else if (typeof data.lastSummaryDate === 'string') {
        // Attempt to parse if it's a string (though ideally it should be Timestamp from Firestore)
        const parsedDate = new Date(data.lastSummaryDate);
        if (!isNaN(parsedDate.getTime())) {
            data.lastSummaryDate = Timestamp.fromDate(parsedDate);
        } else {
            data.lastSummaryDate = null; // Invalid string date
        }
    } else if (!(data.lastSummaryDate instanceof Timestamp) && data.lastSummaryDate !== null) {
        data.lastSummaryDate = null; // Non-timestamp, non-null, non-object with seconds/nanos: treat as invalid
    }

    // Ensure planExpiryDate is a Firestore Timestamp or null
    if (data.planExpiryDate && !(data.planExpiryDate instanceof Timestamp) && typeof data.planExpiryDate === 'object' && 'seconds' in data.planExpiryDate && 'nanoseconds' in data.planExpiryDate) {
      data.planExpiryDate = new Timestamp((data.planExpiryDate as any).seconds, (data.planExpiryDate as any).nanoseconds);
    } else if (typeof data.planExpiryDate === 'string') {
        const parsedExpiry = new Date(data.planExpiryDate);
        if (!isNaN(parsedExpiry.getTime())) {
            data.planExpiryDate = Timestamp.fromDate(parsedExpiry);
        } else {
            data.planExpiryDate = null;
        }
    } else if (!(data.planExpiryDate instanceof Timestamp) && data.planExpiryDate !== null) {
        data.planExpiryDate = null;
    }
    
    // Validate plan type, default to 'free' if invalid
    if (!['free', 'premium', 'pro'].includes(data.plan)) {
      data.plan = 'free';
      data.dailyRemainingQuota = getDefaultQuota('free'); // Reset quota for safety
    }
    return data;
  }
  console.warn(`User profile for ${uid} not found. It should be created on signup.`);
  return null;
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  const userRef = doc(db, "users", uid);
  const dataToUpdate = { ...data };
  // Ensure dates are Timestamps before updating
  if (dataToUpdate.lastSummaryDate && dataToUpdate.lastSummaryDate instanceof Date) {
    dataToUpdate.lastSummaryDate = Timestamp.fromDate(dataToUpdate.lastSummaryDate);
  }
  if (dataToUpdate.planExpiryDate && dataToUpdate.planExpiryDate instanceof Date) {
    dataToUpdate.planExpiryDate = Timestamp.fromDate(dataToUpdate.planExpiryDate);
  }
  await updateDoc(userRef, { ...dataToUpdate, updatedAt: serverTimestamp() });
};

export const getDefaultQuota = (plan: UserProfile["plan"]): number => {
  switch (plan) {
    case "free":
      return FREE_PLAN_DAILY_QUOTA;
    case "premium":
      return PREMIUM_PLAN_DAILY_QUOTA;
    case "pro":
      return PRO_PLAN_DAILY_QUOTA;
    default:
      console.warn(`Unknown plan type: ${plan}, defaulting to free quota.`);
      return FREE_PLAN_DAILY_QUOTA;
  }
};
