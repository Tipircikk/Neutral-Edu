
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, Timestamp, collection, where, query, writeBatch, getDocs, arrayUnion } from "firebase/firestore";
import { db } from "./config";
import type { UserProfile, CouponCode } from "@/types";

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
    
    if (data.lastSummaryDate && !(data.lastSummaryDate instanceof Timestamp) && typeof data.lastSummaryDate === 'object' && 'seconds' in data.lastSummaryDate && 'nanoseconds' in data.lastSummaryDate) {
        data.lastSummaryDate = new Timestamp((data.lastSummaryDate as any).seconds, (data.lastSummaryDate as any).nanoseconds);
    } else if (typeof data.lastSummaryDate === 'string') {
        const parsedDate = new Date(data.lastSummaryDate);
        if (!isNaN(parsedDate.getTime())) {
            data.lastSummaryDate = Timestamp.fromDate(parsedDate);
        } else {
            data.lastSummaryDate = null; 
        }
    } else if (!(data.lastSummaryDate instanceof Timestamp) && data.lastSummaryDate !== null) {
        data.lastSummaryDate = null; 
    }

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
    
    if (!['free', 'premium', 'pro'].includes(data.plan)) {
      data.plan = 'free';
      data.dailyRemainingQuota = getDefaultQuota('free'); 
    }
    return data;
  }
  console.warn(`User profile for ${uid} not found. It should be created on signup.`);
  return null;
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  const userRef = doc(db, "users", uid);
  const dataToUpdate = { ...data };
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

export const redeemCouponCodeInternal = async (uid: string, couponCodeId: string): Promise<{ success: boolean; message: string; newPlan?: UserProfile["plan"]}> => {
  const couponRef = doc(db, "coupons", couponCodeId);
  const userRef = doc(db, "users", uid);

  const batch = writeBatch(db);

  try {
    const couponSnap = await getDoc(couponRef);
    if (!couponSnap.exists()) {
      return { success: false, message: "Geçersiz kupon kodu." };
    }

    const couponData = couponSnap.data() as CouponCode;

    if (!couponData.isActive) {
      return { success: false, message: "Bu kupon artık aktif değil." };
    }

    if (couponData.timesUsed >= couponData.usageLimit) {
      batch.update(couponRef, { isActive: false }); 
      await batch.commit();
      return { success: false, message: "Bu kupon kullanım limitine ulaştı." };
    }
    
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        return { success: false, message: "Kullanıcı bulunamadı." };
    }
    const userProfile = userSnap.data() as UserProfile;

    const planHierarchy: Record<UserProfile["plan"], number> = { pro: 2, premium: 1, free: 0 };
    if (planHierarchy[userProfile.plan] > planHierarchy[couponData.planApplied]) {
        return { success: false, message: `Mevcut planınız (${userProfile.plan}) zaten bu kuponun verdiği plandan (${couponData.planApplied}) daha üstün.`};
    }
    if (userProfile.plan === couponData.planApplied && !userProfile.planExpiryDate) { // Already on same plan and it's indefinite
        return { success: false, message: `Zaten süresiz ${couponData.planApplied} üyesisiniz. Bu kupon size ek bir avantaj sağlamaz.` };
    }

    let newExpiryDate: Timestamp;
    const now = new Date();
    let currentExpiry = userProfile.planExpiryDate instanceof Timestamp ? userProfile.planExpiryDate.toDate() : null;

    if (userProfile.plan === couponData.planApplied && currentExpiry && currentExpiry > now) {
      newExpiryDate = Timestamp.fromDate(new Date(currentExpiry.getTime() + couponData.durationDays * 24 * 60 * 60 * 1000));
    } else {
      newExpiryDate = Timestamp.fromDate(new Date(now.getTime() + couponData.durationDays * 24 * 60 * 60 * 1000));
    }
    
    const newQuota = getDefaultQuota(couponData.planApplied);

    batch.update(userRef, {
      plan: couponData.planApplied,
      planExpiryDate: newExpiryDate,
      dailyRemainingQuota: newQuota, 
      lastSummaryDate: serverTimestamp(), 
      updatedAt: serverTimestamp(),
    });

    const newTimesUsed = couponData.timesUsed + 1;
    const newIsActive = newTimesUsed < couponData.usageLimit;
    batch.update(couponRef, {
      timesUsed: newTimesUsed,
      isActive: newIsActive,
      updatedAt: serverTimestamp(),
      redeemedBy: arrayUnion({ userId: uid, redeemedAt: serverTimestamp() })
    });

    await batch.commit();
    return { success: true, message: `${couponData.durationDays} günlük ${couponData.planApplied} planı başarıyla eklendi!`, newPlan: couponData.planApplied };

  } catch (error: any) {
    console.error("Error redeeming coupon code:", error);
    return { success: false, message: error.message || "Kupon kullanılırken bir hata oluştu." };
  }
};


export const createCouponCodeInFirestore = async (
  couponData: Omit<CouponCode, 'id' | 'timesUsed' | 'createdAt' | 'updatedAt' | 'isActive' | 'redeemedBy'>,
  couponCodeId: string, // This is the actual code string and will be the document ID
  adminUid: string,
  adminEmail: string | null
): Promise<{ success: boolean; message: string; couponId?: string }> => {
  const couponRef = doc(db, "coupons", couponCodeId);

  try {
    const couponSnap = await getDoc(couponRef);
    if (couponSnap.exists()) {
      return { success: false, message: `"${couponCodeId}" kod adlı kupon zaten mevcut.` };
    }

    const newCoupon: CouponCode = {
      id: couponCodeId, // Set the id to the couponCodeId
      ...couponData,
      timesUsed: 0,
      isActive: true,
      createdByAdminId: adminUid,
      createdByAdminEmail: adminEmail,
      redeemedBy: [],
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    await setDoc(couponRef, newCoupon);
    return { success: true, message: `Kupon "${couponCodeId}" başarıyla oluşturuldu.`, couponId: couponCodeId };

  } catch (error: any) {
    console.error("Error creating coupon code in Firestore:", error);
    return { success: false, message: error.message || "Kupon oluşturulurken bir Firestore hatası oluştu." };
  }
};

    