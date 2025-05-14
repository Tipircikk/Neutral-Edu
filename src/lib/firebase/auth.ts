
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
    // Firestore'da kullanıcı belgesi oluştur
    await createUserDocument(userCredential.user.uid, userCredential.user.email);
    return userCredential;
  } catch (error: any) {
    // Daha iyi kullanıcı geri bildirimi için belirli Firebase hata kodlarını işle
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Bu e-posta adresi zaten kullanılıyor.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Şifre çok zayıf.');
    }
    throw new Error(error.message || "Kayıt sırasında bilinmeyen bir hata oluştu.");
  }
};

export const signInWithEmail = async ({ email, password }: AuthCredentials): Promise<UserCredential> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential;
  } catch (error: any) {
     if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      throw new Error('Geçersiz e-posta veya şifre.');
    }
    throw new Error(error.message || "Giriş sırasında bilinmeyen bir hata oluştu.");
  }
};

// signOut, bağlam güncellemelerini sağlamak için @/hooks/useAuth.tsx dosyasından kullanılabilir
// onAuthStateChanged de useAuth.tsx içinde işlenir
