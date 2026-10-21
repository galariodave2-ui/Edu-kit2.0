import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAstYArr-56gpetUZa0doR3ByVvchHytKA",
  authDomain: "edu-tract.firebaseapp.com",
  projectId: "edu-tract",
  storageBucket: "edu-tract.firebasestorage.app",
  messagingSenderId: "928961830965",
  appId: "1:928961830965:web:eb97d1ed389cc04c12d17c",
  measurementId: "G-1Q33WCGF4P"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
