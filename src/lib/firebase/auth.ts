
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  type UserCredential
} from "firebase/auth";
import { auth } from "./config";
import { createUserDocument } from "./firestore";

interface AuthCredentials {
  email: string;
  password: string;
}

export const signUpWithEmail = async ({ email, password }: AuthCredentials): Promise<UserCredential> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Create user document in Firestore
    await createUserDocument(userCredential.user.uid, userCredential.user.email);
    return userCredential;
  } catch (error: any) {
    // Handle specific Firebase error codes for better user feedback
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email address is already in use.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('The password is too weak.');
    }
    throw new Error(error.message || "An unknown error occurred during sign up.");
  }
};

export const signInWithEmail = async ({ email, password }: AuthCredentials): Promise<UserCredential> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential;
  } catch (error: any) {
     if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      throw new Error('Invalid email or password.');
    }
    throw new Error(error.message || "An unknown error occurred during sign in.");
  }
};

// signOut is available from @/hooks/useAuth.tsx to ensure context updates
// onAuthStateChanged is also handled in useAuth.tsx
