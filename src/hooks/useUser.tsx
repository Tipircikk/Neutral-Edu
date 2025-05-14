
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
      toast({ title: "Error", description: "Failed to load user profile.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authUser) {
      fetchUserProfile(authUser.uid);
    } else if (!authLoading) {
      setUserProfile(null); // Clear profile if no auth user and auth is not loading
      setLoading(false);
    }
  }, [authUser, authLoading, fetchUserProfile]);

  const checkAndResetQuota = useCallback(async (): Promise<UserProfile | null> => {
    if (!authUser || !userProfile) return userProfile;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    let lastSummaryDateObj: Date | null = null;
    if (userProfile.lastSummaryDate) {
      if (userProfile.lastSummaryDate instanceof Timestamp) {
        lastSummaryDateObj = userProfile.lastSummaryDate.toDate();
      } else if (typeof userProfile.lastSummaryDate === 'string') {
        lastSummaryDateObj = new Date(userProfile.lastSummaryDate); // Handle potential string date
      }
      if (lastSummaryDateObj) {
        lastSummaryDateObj.setHours(0,0,0,0); // Start of that day
      }
    }
    
    if (!lastSummaryDateObj || lastSummaryDateObj.getTime() < today.getTime()) {
      const newQuota = getDefaultQuota(userProfile.plan);
      const updatedProfileFields: Partial<UserProfile> = {
        dailyRemainingQuota: newQuota,
        lastSummaryDate: Timestamp.fromDate(today),
      };
      try {
        await updateUserProfile(authUser.uid, updatedProfileFields);
        const updatedProfile = { ...userProfile, ...updatedProfileFields };
        setUserProfile(updatedProfile);
        return updatedProfile;
      } catch (error) {
        console.error("Error resetting quota:", error);
        toast({ title: "Error", description: "Failed to update daily quota.", variant: "destructive" });
        return userProfile; // Return old profile on error
      }
    }
    return userProfile;
  }, [authUser, userProfile, toast]);


  const decrementQuota = useCallback(async () => {
    if (!authUser || !userProfile || userProfile.dailyRemainingQuota <= 0) return false;

    const newQuota = userProfile.dailyRemainingQuota - 1;
    const today = new Date(); // Ensure lastSummaryDate is also updated
    try {
      const updatedFields: Partial<UserProfile> = { 
        dailyRemainingQuota: newQuota,
        lastSummaryDate: Timestamp.fromDate(today) // Update last summary date to today
      };
      await updateUserProfile(authUser.uid, updatedFields);
      setUserProfile(prev => prev ? { ...prev, ...updatedFields } : null);
      return true;
    } catch (error) {
      console.error("Error decrementing quota:", error);
      toast({ title: "Error", description: "Failed to update your quota.", variant: "destructive" });
      return false;
    }
  }, [authUser, userProfile, toast]);

  return { userProfile, loading: loading || authLoading, fetchUserProfile, checkAndResetQuota, decrementQuota };
};
