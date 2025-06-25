import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBpUGDa-HNj5U2tCiqt1BQiCai5XQT7-xQ",
  authDomain: "neutraledumain.firebaseapp.com",
  projectId: "neutraledumain",
  storageBucket: "neutraledumain.firebasestorage.app",
  messagingSenderId: "721523329830",
  appId: "1:721523329830:web:b5339e7a1df59db0250fe7",
  measurementId: "G-LQYC0X8TZD"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;