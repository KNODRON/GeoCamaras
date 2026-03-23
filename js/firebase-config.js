import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBinfL_PpNgWpHZ6cVA25LAkdaE9hDgoAI",
  authDomain: "geocamara-913d6.firebaseapp.com",
  projectId: "geocamara-913d6",
  storageBucket: "geocamara-913d6.firebasestorage.app",
  messagingSenderId: "805498931282",
  appId: "G-WM6LV8TCJ2"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
