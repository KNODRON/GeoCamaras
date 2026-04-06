import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function requireRole(expectedRole, onSuccess) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "./login.html";
      return;
    }

    try {
      const ref = doc(db, "usuarios", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await signOut(auth);
        window.location.href = "./login.html";
        return;
      }

      const profile = snap.data();

      if (!profile.activo) {
        await signOut(auth);
        window.location.href = "./login.html";
        return;
      }

      if (expectedRole === "admin" && profile.rol !== "admin") {
        window.location.href = "./operador.html";
        return;
      }

      if (expectedRole === "operador" && !["operador", "admin"].includes(profile.rol)) {
        await signOut(auth);
        window.location.href = "./login.html";
        return;
      }

      onSuccess(user, profile);
    } catch (error) {
      console.error("Error validando rol:", error);
      window.location.href = "./login.html";
    }
  });
}