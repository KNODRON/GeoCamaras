import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function requireRole(expectedRole, onSuccess) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "./index.html";
      return;
    }

    try {
      const ref = doc(db, "usuarios", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await signOut(auth);
        window.location.href = "./index.html";
        return;
      }

      const profile = snap.data();

      if (!profile.activo) {
        await signOut(auth);
        window.location.href = "./index.html";
        return;
      }

      if (expectedRole === "admin" && profile.rol !== "admin") {
        window.location.href = "./operador.html";
        return;
      }

      if (expectedRole === "operador" && !["operador", "admin"].includes(profile.rol)) {
        await signOut(auth);
        window.location.href = "./index.html";
        return;
      }

      onSuccess(user, profile);
    } catch (error) {
      console.error("Error validando rol:", error);
      window.location.href = "./index.html";
    }
  });

  import { getAuth, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    console.log("Acceso permitido:", user.email);
  }
});
}
