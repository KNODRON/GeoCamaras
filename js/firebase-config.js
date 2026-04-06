import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAO4zoD0wcnRnxTwPTm--DWndvO-h4FGkU",
  authDomain: "georegistro-60e8b.firebaseapp.com",
  projectId: "georegistro-60e8b",
  storageBucket: "georegistro-60e8b.firebasestorage.app",
  messagingSenderId: "277287558145",
  appId: "1:277287558145:web:7be79ca42e9fed466db400"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
