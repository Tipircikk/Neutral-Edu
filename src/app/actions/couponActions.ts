
"use server";

import { auth } from "@/lib/firebase/config";
import { redeemCouponCodeInternal, createCouponCodeInFirestore, getUserProfile } from "@/lib/firebase/firestore";
import type { CouponCode, UserProfile } from "@/types";

interface CouponActionResult {
  success: boolean;
  message: string;
  newPlan?: UserProfile["plan"];
}

export const applyCouponCodeAction = async (couponCode: string): Promise<CouponActionResult> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { success: false, message: "Kupon kullanmak için giriş yapmalısınız." };
  }

  try {
    const result = await redeemCouponCodeInternal(currentUser.uid, couponCode);
    return result;
  } catch (error: any) {
    console.error("applyCouponCodeAction error:", error);
    return { success: false, message: error.message || "Sunucu tarafında kupon işlenirken bir hata oluştu." };
  }
};

export interface CouponCreationFormData {
  couponCodeId: string;
  planApplied: "premium" | "pro";
  durationDays: number;
  usageLimit: number;
}

export const createCouponAction = async (
  formData: CouponCreationFormData,
  adminUid: string,
  adminEmail: string | null
): Promise<{ success: boolean; message: string; couponId?: string }> => {
  if (!adminUid) {
    return { success: false, message: "Admin UID bulunamadı. Yetkilendirme hatası." };
  }
  
  // Optional: Re-verify admin status on server if critical, though client-side check is primary.
  // const adminProfile = await getUserProfile(adminUid);
  // if (!adminProfile?.isAdmin) {
  //   return { success: false, message: "Bu işlemi yapmak için admin yetkiniz yok." };
  // }

  const couponDataToCreate: Omit<CouponCode, 'id' | 'timesUsed' | 'createdAt' | 'updatedAt' | 'isActive' | 'redeemedBy' | 'createdByAdminId' | 'createdByAdminEmail'> = {
    planApplied: formData.planApplied,
    durationDays: formData.durationDays,
    usageLimit: formData.usageLimit,
  };

  try {
    const result = await createCouponCodeInFirestore(
      couponDataToCreate,
      formData.couponCodeId,
      adminUid,
      adminEmail
    );
    return result;
  } catch (error: any) {
    console.error("createCouponAction error:", error);
    return { success: false, message: error.message || "Sunucu tarafında kupon oluşturulurken bir hata oluştu." };
  }
};

    