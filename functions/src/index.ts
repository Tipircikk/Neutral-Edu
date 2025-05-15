
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import type { UserProfile } from "./types"; // Assuming types are somehow available or defined here

// Initialize Firebase Admin SDK
// Ensure your service account key is set up in your Firebase environment
// for Functions to have admin privileges.
// https://firebase.google.com/docs/functions/beta/setup-environment#initialize-admin-sdk
try {
  admin.initializeApp();
} catch (e) {
  console.error("Firebase admin initialization error", e);
}

const db = admin.firestore();

/**
 * Scheduled function to check for expired subscriptions and revert users to the free plan.
 * This function should be scheduled to run daily (e.g., using Google Cloud Scheduler).
 *
 * To deploy (after setting up Firebase CLI and logging in):
 * 1. Ensure you have `firebase-tools` installed (`npm install -g firebase-tools`).
 * 2. Navigate to your project's root directory (where `firebase.json` is).
 * 3. Run `firebase deploy --only functions` or `firebase deploy --only functions:checkExpiredSubscriptions`.
 *
 * To schedule this function (e.g., daily at midnight):
 * You can use Google Cloud Scheduler with a Pub/Sub trigger.
 * Target: Pub/Sub
 * Topic: Create a new topic, e.g., `daily-subscription-check-trigger`
 * Frequency: `0 0 * * *` (cron syntax for daily at midnight)
 *
 * Then, in your function, trigger it via Pub/Sub:
 * `export const checkExpiredSubscriptions = functions.pubsub.topic('daily-subscription-check-trigger').onPublish(async (message) => { ... });`
 *
 * OR, for simpler scheduling directly with Firebase Functions (v1 syntax for scheduled functions):
 * `export const checkExpiredSubscriptions = functions.pubsub.schedule('every 24 hours').onRun(async (context) => { ... });`
 * (Note: For v2 functions, scheduling is typically done via Google Cloud Scheduler directly targeting the HTTP function or using Eventarc.)
 *
 * For this example, I'll use the `functions.pubsub.schedule` for simplicity, assuming v1 Functions syntax for scheduling.
 * If you are using v2 Firebase Functions, you'll need to set up scheduling via Google Cloud Console for an HTTP-triggered function.
 */

// Define UserProfile type here if not imported from a shared location
// This is a simplified version for the function's context.
// Ensure it matches the structure in your main app's `src/types/index.ts`.
interface FunctionUserProfile {
  uid: string;
  email: string | null;
  plan: "free" | "premium" | "pro";
  dailyRemainingQuota: number;
  planExpiryDate?: admin.firestore.Timestamp | null; // Firestore Timestamp
  // other fields...
}


const FREE_PLAN_DAILY_QUOTA_FN = 2; // Ensure this matches your main app config

export const checkExpiredSubscriptions = functions.region("europe-west1") // Specify your region
  .pubsub.schedule("every 24 hours") // Runs daily
  .onRun(async (context) => {
    console.log("Running scheduled function: checkExpiredSubscriptions");

    const now = admin.firestore.Timestamp.now();
    const usersRef = db.collection("users");

    // Query for users with 'premium' or 'pro' plans whose planExpiryDate is in the past
    const expiredPremiumQuery = usersRef
      .where("plan", "==", "premium")
      .where("planExpiryDate", "<=", now);

    const expiredProQuery = usersRef
      .where("plan", "==", "pro")
      .where("planExpiryDate", "<=", now);

    try {
      const [premiumSnapshot, proSnapshot] = await Promise.all([
        expiredPremiumQuery.get(),
        expiredProQuery.get(),
      ]);

      const batch = db.batch();
      let usersReverted = 0;

      const processSnapshot = (snapshot: admin.firestore.QuerySnapshot) => {
        snapshot.forEach((doc) => {
          const user = doc.data() as FunctionUserProfile;
          console.log(`User ${user.email || user.uid} subscription expired. Reverting to free plan.`);
          const userDocRef = usersRef.doc(doc.id);
          batch.update(userDocRef, {
            plan: "free",
            dailyRemainingQuota: FREE_PLAN_DAILY_QUOTA_FN, // Reset quota to free plan's default
            planExpiryDate: null, // Clear expiry date
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          usersReverted++;
        });
      };

      processSnapshot(premiumSnapshot);
      processSnapshot(proSnapshot);

      if (usersReverted > 0) {
        await batch.commit();
        console.log(`Successfully reverted ${usersReverted} users to the free plan.`);
      } else {
        console.log("No expired subscriptions found to revert.");
      }
      return null;
    } catch (error) {
      console.error("Error checking for expired subscriptions:", error);
      return null;
    }
  });

// Placeholder for other potential backend functions.
// For example, if you had complex data aggregation or notification tasks.

/**
 * NOTE: You'll need to install `firebase-admin` and `firebase-functions`
 * as dependencies in your `functions/package.json` file.
 *
 * Example `functions/package.json`:
 * {
 *   "name": "functions",
 *   "scripts": {
 *     "lint": "eslint --ext .js,.ts .",
 *     "build": "tsc",
 *     "serve": "npm run build && firebase emulators:start --only functions",
 *     "shell": "npm run build && firebase functions:shell",
 *     "start": "npm run shell",
 *     "deploy": "firebase deploy --only functions",
 *     "logs": "firebase functions:log"
 *   },
 *   "engines": {
 *     "node": "18" // Or your preferred Node.js version supported by Firebase Functions
 *   },
 *   "main": "lib/index.js",
 *   "dependencies": {
 *     "firebase-admin": "^12.0.0", // Use appropriate version
 *     "firebase-functions": "^5.0.0" // Use appropriate version
 *   },
 *   "devDependencies": {
 *     "@typescript-eslint/eslint-plugin": "^7.1.1",
 *     "@typescript-eslint/parser": "^7.1.1",
 *     "eslint": "^8.57.0",
 *     "eslint-plugin-import": "^2.29.1",
 *     "typescript": "^5.3.3" // Use appropriate version
 *   },
 *   "private": true
 * }
 *
 * And a `functions/tsconfig.json`:
 * {
 *   "compilerOptions": {
 *     "module": "commonjs",
 *     "noImplicitReturns": true,
 *     "noUnusedLocals": true,
 *     "outDir": "lib",
 *     "sourceMap": true,
 *     "strict": true,
 *     "target": "es2017", // Or a newer target compatible with your Node.js version
 *      "esModuleInterop": true,
 *      "skipLibCheck": true,
 *      "resolveJsonModule": true
 *   },
 *   "compileOnSave": true,
 *   "include": [
 *     "src"
 *   ]
 * }
 */
