
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { getUserProfile, updateUserProfile, getDefaultQuota } from "@/lib/firebase/firestore";
import type { UserProfile } from "@/types";
import { Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export const useUser = () => {
  const { user: authUser, loading: authLoading } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUserProfile = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const profile = await getUserProfile(uid);
      setUserProfile(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      toast({ title: "Hata", description: "Kullanıcı profili yüklenemedi.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authUser) {
      fetchUserProfile(authUser.uid);
    } else if (!authLoading) {
      setUserProfile(null); 
      setLoading(false);
    }
  }, [authUser, authLoading, fetchUserProfile]);

  const checkAndResetQuota = useCallback(async (): Promise<UserProfile | null> => {
    if (!authUser) {
      console.warn("checkAndResetQuota called without an authenticated user.");
      return userProfile; // Return current profile or null if no authUser
    }
    
    // Fetch the latest profile to ensure we have the most up-to-date data from Firestore
    // This is important if this function is called multiple times in quick succession
    // or if background updates might have occurred.
    const freshProfile = await getUserProfile(authUser.uid);
    if (!freshProfile) {
        console.warn("checkAndResetQuota: Could not fetch fresh profile for user.", authUser.uid);
        return userProfile; // Fallback to existing state if fresh fetch fails
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    let lastSummaryDateObj: Date | null = null;
    if (freshProfile.lastSummaryDate) {
      if (freshProfile.lastSummaryDate instanceof Timestamp) {
        lastSummaryDateObj = freshProfile.lastSummaryDate.toDate();
      } else if (typeof freshProfile.lastSummaryDate === 'string') {
        const parsedDate = new Date(freshProfile.lastSummaryDate);
        if (!isNaN(parsedDate.getTime())) {
          lastSummaryDateObj = parsedDate;
        } else {
          console.warn("Invalid date string in lastSummaryDate:", freshProfile.lastSummaryDate);
        }
      }
      if (lastSummaryDateObj) {
        lastSummaryDateObj.setHours(0, 0, 0, 0); 
      }
    }
    
    if (!lastSummaryDateObj || lastSummaryDateObj.getTime() < today.getTime()) {
      const newQuota = getDefaultQuota(freshProfile.plan);
      const updatedProfileFields: Partial<UserProfile> = {
        dailyRemainingQuota: newQuota,
        lastSummaryDate: Timestamp.fromDate(today),
      };
      try {
        await updateUserProfile(authUser.uid, updatedProfileFields);
        const updatedProfileFromReset = { ...freshProfile, ...updatedProfileFields };
        setUserProfile(updatedProfileFromReset); // Update local state with the reset profile
        return updatedProfileFromReset;
      } catch (error) {
        console.error("Error resetting quota:", error);
        toast({ title: "Hata", description: "Günlük kota güncellenirken bir hata oluştu.", variant: "destructive" });
        setUserProfile(freshProfile); // Revert to fresh profile on error
        return freshProfile; 
      }
    }
    setUserProfile(freshProfile); // Ensure local state is synced if no reset was needed
    return freshProfile;
  }, [authUser, toast, setUserProfile]); // Removed userProfile from deps to rely on fresh fetch


  const decrementQuota = useCallback(async (profileData: UserProfile) => {
    if (!authUser) {
        return false;
    }
    if (!profileData) {
        return false;
    }
    // Use the quota from the passed profileData, which should be fresh (e.g., after checkAndResetQuota)
    if (profileData.dailyRemainingQuota <= 0) {
      return false;
    }

    const newQuota = profileData.dailyRemainingQuota - 1;
    const today = new Date(); // Use current date for lastSummaryDate on decrement
    try {
      const updatedFields: Partial<UserProfile> = {
        dailyRemainingQuota: newQuota,
        lastSummaryDate: Timestamp.fromDate(today) // Always update lastSummaryDate on any quota change
      };
      await updateUserProfile(authUser.uid, updatedFields);
      setUserProfile(prev => {
        if (!prev) return null;
        // Ensure the update is based on the profileData that was used for decrement logic,
        // and then apply the new fields.
        return { ...profileData, ...updatedFields };
      });
      return true;
    } catch (error) {
      console.error("Error decrementing quota:", error);
      toast({ title: "Hata", description: "Kota güncellenirken bir hata oluştu.", variant: "destructive" });
      return false;
    }
  }, [authUser, toast, setUserProfile]);

  return { userProfile, loading: loading || authLoading, fetchUserProfile, checkAndResetQuota, decrementQuota };
};

