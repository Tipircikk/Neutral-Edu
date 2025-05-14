
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "./config";
import type { UserProfile } from "@/types";

const FREE_PLAN_DAILY_QUOTA = 5;

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
    plan: "free",
    dailyRemainingQuota: FREE_PLAN_DAILY_QUOTA,
    lastSummaryDate: null, // Will be set on first summary or quota check
    isAdmin: false, // Default isAdmin to false
  };
  await setDoc(userRef, { ...userProfile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return userProfile;
};

export const getUserProfile = async (uid:string): Promise<UserProfile | null> => {
  const userRef = doc(db, "users", uid);
  const docSnap = await getDoc(userRef);
  if (docSnap.exists()) {
    const data = docSnap.data() as UserProfile;
    // Ensure lastSummaryDate is a Firestore Timestamp or null for client-side JS Date compatibility
    if (data.lastSummaryDate && !(data.lastSummaryDate instanceof Timestamp) && typeof data.lastSummaryDate === 'object' && 'seconds' in data.lastSummaryDate && 'nanoseconds' in data.lastSummaryDate) {
        data.lastSummaryDate = new Timestamp((data.lastSummaryDate as any).seconds, (data.lastSummaryDate as any).nanoseconds);
    }
    return data;
  }
  // Optionally create profile if it doesn't exist, though signup should handle this.
  // For this app, we assume signup creates the profile.
  console.warn(`User profile for ${uid} not found. It should be created on signup.`);
  return null;
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  const userRef = doc(db, "users", uid);
  // Ensure lastSummaryDate is converted to Firestore Timestamp if it's a Date object
  const dataToUpdate = { ...data };
  if (dataToUpdate.lastSummaryDate && dataToUpdate.lastSummaryDate instanceof Date) {
    dataToUpdate.lastSummaryDate = Timestamp.fromDate(dataToUpdate.lastSummaryDate);
  }
  await updateDoc(userRef, { ...dataToUpdate, updatedAt: serverTimestamp() });
};

export const getDefaultQuota = (plan: UserProfile["plan"]): number => {
  switch (plan) {
    case "free":
      return FREE_PLAN_DAILY_QUOTA;
    // Add other plans here if needed
    // case "premium":
    //   return PREMIUM_PLAN_DAILY_QUOTA;
    default:
      return FREE_PLAN_DAILY_QUOTA;
  }
};

