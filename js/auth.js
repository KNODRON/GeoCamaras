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
  console.log("onAuthStateChanged ejecutado:", user);

  if (!user) {
    console.log("No hay usuario autenticado todavía.");
    return;
  }

  try {
    console.log("UID autenticado:", user.uid);

    const ref = doc(db, "usuarios", user.uid);
    const snap = await getDoc(ref);

    console.log("Documento usuarios leído:", snap.exists());

    if (!snap.exists()) {
      loginMessage.textContent = "Usuario autenticado, pero sin perfil asignado.";
      console.warn("No existe documento en /usuarios para UID:", user.uid);
      return;
    }

    const data = snap.data();
    console.log("Datos del perfil:", data);

    if (!data.activo) {
      loginMessage.textContent = "Usuario desactivado.";
      console.warn("Usuario inactivo:", user.uid);
      return;
    }

    if (data.rol === "admin") {
      console.log("Redirigiendo a admin.html");
      loginMessage.textContent = "Redirigiendo a administrador...";
      window.location.href = "./admin.html";
    } else if (data.rol === "operador") {
      console.log("Redirigiendo a operador.html");
      loginMessage.textContent = "Redirigiendo a operador...";
      window.location.href = "./operador.html";
    } else {
      loginMessage.textContent = "Rol inválido en Firestore.";
      console.warn("Rol no reconocido:", data.rol);
    }
  } catch (error) {
    console.error("Error validando perfil:", error);
    loginMessage.textContent = "No se pudo validar el perfil del usuario.";
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  loginMessage.textContent = "Validando acceso...";

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log("Login correcto:", cred.user);
    loginMessage.textContent = "Acceso correcto.";
  } catch (error) {
    console.error("Error login:", error);
    loginMessage.textContent = "Correo o contraseña incorrectos.";
  }
});
