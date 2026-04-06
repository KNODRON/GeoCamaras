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
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

if (!loginForm || !loginMessage || !emailInput || !passwordInput) {
  console.error("No se encontraron los elementos del formulario de login.");
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
      loginMessage.style.color = "#1f2a33";
      loginMessage.textContent = "Validando perfil...";

      const ref = doc(db, "usuarios", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        loginMessage.style.color = "#b00020";
        loginMessage.textContent = "Usuario autenticado, pero sin perfil asignado.";
        return;
      }

      const data = snap.data();

      if (!data.activo) {
        loginMessage.style.color = "#b00020";
        loginMessage.textContent = "Usuario desactivado.";
        return;
      }

      if (data.rol === "admin") {
        loginMessage.style.color = "#1f2a33";
        loginMessage.textContent = "Redirigiendo a panel principal...";
        window.location.href = "./index.html";
      } else if (data.rol === "operador") {
        loginMessage.style.color = "#1f2a33";
        loginMessage.textContent = "Redirigiendo a operador...";
        window.location.href = "./operador.html";
      } else {
        loginMessage.style.color = "#b00020";
        loginMessage.textContent = "Rol inválido en Firestore.";
      }
    } catch (error) {
      console.error("Error validando perfil:", error);
      loginMessage.style.color = "#b00020";
      loginMessage.textContent = "No se pudo validar el perfil del usuario.";
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    loginMessage.style.color = "#1f2a33";
    loginMessage.textContent = "Validando acceso...";

    try {
      await signInWithEmailAndPassword(auth, email, password);
      loginMessage.textContent = "Acceso correcto.";
    } catch (error) {
      console.error("Error login:", error);
      loginMessage.style.color = "#b00020";
      loginMessage.textContent = "Correo o contraseña incorrectos.";
    }
  });
}