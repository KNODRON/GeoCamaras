import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const ref = doc(db, "usuarios", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      loginMessage.textContent = "Usuario autenticado, pero sin perfil asignado.";
      return;
    }

    const data = snap.data();

    if (!data.activo) {
      loginMessage.textContent = "Usuario desactivado.";
      return;
    }

    if (data.rol === "admin") {
      window.location.href = "./admin.html";
    } else {
      window.location.href = "./operador.html";
    }
  } catch (error) {
    console.error(error);
    loginMessage.textContent = "No se pudo validar el perfil del usuario.";
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  loginMessage.textContent = "Validando acceso...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginMessage.textContent = "Acceso correcto.";
  } catch (error) {
    console.error(error);
    loginMessage.textContent = "Correo o contraseña incorrectos.";
  }
});
