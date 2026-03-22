import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================
   FIREBASE CONFIG
========================= */
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* =========================
   ELEMENTOS
========================= */
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const operadorPanel = document.getElementById("operador-panel");
const adminPanel = document.getElementById("admin-panel");
const roleBadge = document.getElementById("user-role-badge");

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");
const logoutBtn = document.getElementById("logoutBtn");

const categoriasGrid = document.getElementById("categoriasGrid");
const categoriaSeleccionada = document.getElementById("categoriaSeleccionada");
const descripcion = document.getElementById("descripcion");
const latitud = document.getElementById("latitud");
const longitud = document.getElementById("longitud");
const direccion = document.getElementById("direccion");
const btnGPS = document.getElementById("btnGPS");
const registroForm = document.getElementById("registroForm");
const registroMessage = document.getElementById("registroMessage");

const filtroCategoria = document.getElementById("filtroCategoria");
const filtroEstado = document.getElementById("filtroEstado");
const filtroTexto = document.getElementById("filtroTexto");
const btnAplicarFiltros = document.getElementById("btnAplicarFiltros");
const btnLimpiarFiltros = document.getElementById("btnLimpiarFiltros");
const btnExportarCSV = document.getElementById("btnExportarCSV");
const adminTableBody = document.getElementById("admin-table-body");

const cardTotal = document.getElementById("card-total");
const cardHoy = document.getElementById("card-hoy");
const cardPendientes = document.getElementById("card-pendientes");
const cardResueltas = document.getElementById("card-resueltas");

/* =========================
   ESTADO
========================= */
let currentUserData = null;
let operadorMap = null;
let adminMap = null;
let operadorMarker = null;
let adminMarkersLayer = null;
let allIncidencias = [];

/* =========================
   LOGIN
========================= */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMessage.textContent = "Ingresando...";

  try {
    await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
    loginMessage.textContent = "";
  } catch (error) {
    console.error(error);
    loginMessage.textContent = "No se pudo iniciar sesión.";
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
    operadorPanel.classList.add("hidden");
    adminPanel.classList.add("hidden");
    currentUserData = null;
    return;
  }

  try {
    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      alert("No existe perfil para este usuario.");
      await signOut(auth);
      return;
    }

    const userData = userSnap.data();

    if (!userData.activo) {
      alert("Usuario desactivado.");
      await signOut(auth);
      return;
    }

    currentUserData = {
      uid: user.uid,
      ...userData
    };

    loginView.classList.add("hidden");
    appView.classList.remove("hidden");

    renderVistaPorRol(currentUserData);
  } catch (error) {
    console.error("Error al cargar perfil:", error);
    alert("No se pudo cargar el perfil del usuario.");
  }
});

/* =========================
   ROLES
========================= */
function renderVistaPorRol(userData) {
  operadorPanel.classList.add("hidden");
  adminPanel.classList.add("hidden");

  roleBadge.textContent = `${userData.nombre || "Usuario"} · ${userData.rol}`;

  if (userData.rol === "admin") {
    adminPanel.classList.remove("hidden");
    initAdminPanel();
  } else {
    operadorPanel.classList.remove("hidden");
    initOperadorPanel();
  }
}

/* =========================
   OPERADOR
========================= */
function initOperadorPanel() {
  setTimeout(() => {
    initOperadorMap();
  }, 50);
}

function initOperadorMap() {
  if (operadorMap) return;

  operadorMap = L.map("map-operador").setView([-33.45, -70.67], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(operadorMap);

  setTimeout(() => operadorMap.invalidateSize(), 200);
}

/* =========================
   CATEGORÍAS
========================= */
categoriasGrid?.addEventListener("click", (e) => {
  const btn = e.target.closest(".card-btn");
  if (!btn) return;

  document.querySelectorAll(".card-btn").forEach(el => el.classList.remove("active"));
  btn.classList.add("active");

  categoriaSeleccionada.value = btn.dataset.categoria || "";
});

/* =========================
   GPS
========================= */
btnGPS?.addEventListener("click", () => {
  registroMessage.textContent = "Obteniendo ubicación...";

  if (!navigator.geolocation) {
    registroMessage.textContent = "Tu navegador no soporta geolocalización.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      latitud.value = lat.toFixed(6);
      longitud.value = lng.toFixed(6);

      registroMessage.textContent = "Ub
