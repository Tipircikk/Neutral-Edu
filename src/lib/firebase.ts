import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "apikey",
  authDomain: "authdomain",
  projectId: "projectid",
  storageBucket: "storagebucket",
  messagingSenderId: "messagingSenderId",
  appId: "appid",
  measurementId: "measurementid"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;