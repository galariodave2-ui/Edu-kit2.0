import { initializeApp, getApps, getApp } from "firebase/app";
import {
    getAuth,
    GoogleAuthProvider
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAstYArr-56gpetUZa0doR3ByVvchHytKA",
    authDomain: "edu-tract.firebaseapp.com",
    projectId: "edu-tract",
    storageBucket: "edu-tract.firebasestorage.app",
    messagingSenderId: "928961830965",
    appId: "1:928961830965:web:eb97d1ed389cc04c12d17c",
    measurementId: "G-1Q33WCGF4P"
};

const app = getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export {
    app,
    auth,
    db,
    googleProvider
};