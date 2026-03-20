import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const typeButtons = document.querySelectorAll(".type-btn");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const authStatus = document.getElementById("authStatus");
const userInfo = document.getElementById("userInfo");

const observacionInput = document.getElementById("observacion");
const direccionRefInput = document.getElementById("direccionRef");
const statusBox = document.getElementById("statusBox");
const recordsList = document.getElementById("recordsList");

const btnUbicacion = document.getElementById("btnUbicacion");
const btnLimpiarCampos = document.getElementById("btnLimpiarCampos");
const btnCentrarMapa = document.getElementById("btnCentrarMapa");
const btnActualizarMapa = document.getElementById("btnActualizarMapa");

let currentUserProfile = null;
let camerasCache = [];
let map = null;
let markersLayer = null;
let mapInitialized = false;
let unsubscribeCameras = null;

function setAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.style.color = isError ? "#b91c1c" : "#374151";
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.style.color = isError ? "#b91c1c" : "#374151";
}

function formatDate(value) {
  if (!value) return "-";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString("es-CL");
}

function getEmoji(type) {
  const icons = {
    Casa: "🏠",
    Edificio: "🏢",
    Colegio: "🏫",
    Empresa: "🏭",
    Municipal: "🚓",
    Transporte: "🚌"
  };
  return icons[type] || "📷";
}

function switchTab(tabName) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });

  if (tabName === "mapa") {
    initMap();
    setTimeout(() => {
      map.invalidateSize();
      renderMapMarkers();
    }, 150);
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

async function login() {
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      setAuthStatus("Debes ingresar correo y contraseña.", true);
      return;
    }

    await signInWithEmailAndPassword(auth, email, password);
    setAuthStatus("Sesión iniciada correctamente.");
  } catch (error) {
    console.error(error);
    setAuthStatus("No fue posible iniciar sesión.", true);
  }
}

async function logout() {
  try {
    await signOut(auth);
    currentUserProfile = null;
    userInfo.textContent = "Sin sesión";

    if (unsubscribeCameras) {
      unsubscribeCameras();
      unsubscribeCameras = null;
    }

    camerasCache = [];
    renderRecordsList();
    renderMapMarkers();

    setAuthStatus("Sesión cerrada.");
  } catch (error) {
    console.error(error);
    setAuthStatus("No fue posible cerrar sesión.", true);
  }
}

btnLogin.addEventListener("click", login);
btnLogout.addEventListener("click", logout);

async function loadUserProfile(uid) {
  const userRef = doc(db, "usuarios", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    currentUserProfile = null;
    userInfo.textContent = "Usuario sin perfil";
    setAuthStatus("Tu usuario existe, pero no tiene perfil en Firestore.", true);
    return;
  }

  currentUserProfile = { uid, ...snap.data() };
  userInfo.textContent = `${currentUserProfile.nombre} · ${currentUserProfile.rol}`;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUserProfile = null;
    userInfo.textContent = "Sin sesión";
    return;
  }

  await loadUserProfile(user.uid);

  if (currentUserProfile?.activo !== true) {
    setAuthStatus("Tu usuario está inactivo.", true);
    return;
  }

  subscribeToCameras();
});

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalización no soportada"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}

async function registerCamera(type) {
  try {
    if (!auth.currentUser || !currentUserProfile) {
      setStatus("Debes iniciar sesión primero.", true);
      return;
    }

    if (currentUserProfile.activo !== true) {
      setStatus("Tu usuario no está activo.", true);
      return;
    }

    setStatus(`Registrando cámara tipo: ${type}...`);

    const position = await getCurrentPosition();
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    await addDoc(collection(db, "camaras"), {
      type,
      lat,
      lng,
      observacion: observacionInput.value.trim(),
      referencia: direccionRefInput.value.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      usuarioUid: auth.currentUser.uid,
      usuarioNombre: currentUserProfile.nombre,
      estado: "activo",
      validado: false
    });

    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    observacionInput.value = "";
    direccionRefInput.value = "";

    setStatus(`✅ Cámara registrada: ${type} (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
  } catch (error) {
    console.error(error);
    setStatus("No fue posible guardar el registro.", true);
  }
}

typeButtons.forEach((btn) => {
  btn.addEventListener("click", () => registerCamera(btn.dataset.type));
});

function renderRecordsList() {
  if (camerasCache.length === 0) {
    recordsList.innerHTML = `<div class="empty-box">Aún no hay registros.</div>`;
    return;
  }

  recordsList.innerHTML = camerasCache
    .filter((record) => record.estado === "activo")
    .map(
      (record) => `
        <div class="record-item">
          <div class="record-title">${getEmoji(record.type)} ${record.type}</div>
          <small><strong>Fecha:</strong> ${formatDate(record.createdAt)}</small>
          <small><strong>Usuario:</strong> ${record.usuarioNombre || "-"}</small>
          <small><strong>Lat:</strong> ${record.lat?.toFixed(6)}</small>
          <small><strong>Lng:</strong> ${record.lng?.toFixed(6)}</small>
          <small><strong>Referencia:</strong> ${record.referencia || "-"}</small>
          <small><strong>Observación:</strong> ${record.observacion || "-"}</small>
          <small><strong>Estado:</strong> ${record.estado || "-"}</small>
        </div>
      `
    )
    .join("");
}

function initMap() {
  if (mapInitialized) return;

  map = L.map("map").setView([-33.4489, -70.6693], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  mapInitialized = true;
}

function renderMapMarkers() {
  if (!mapInitialized) return;

  markersLayer.clearLayers();

  const activeRecords = camerasCache.filter((record) => record.estado === "activo");
  if (activeRecords.length === 0) return;

  const bounds = [];

  activeRecords.forEach((record) => {
    const marker = L.marker([record.lat, record.lng]).bindPopup(`
      <strong>${getEmoji(record.type)} ${record.type}</strong><br>
      Usuario: ${record.usuarioNombre || "-"}<br>
      Fecha: ${formatDate(record.createdAt)}<br>
      Referencia: ${record.referencia || "-"}<br>
      Observación: ${record.observacion || "-"}
    `);

    marker.addTo(markersLayer);
    bounds.push([record.lat, record.lng]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}

function subscribeToCameras() {
  if (unsubscribeCameras) unsubscribeCameras();

  const q = query(collection(db, "camaras"), orderBy("createdAt", "desc"));

  unsubscribeCameras = onSnapshot(
    q,
    (snapshot) => {
      camerasCache = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      renderRecordsList();
      renderMapMarkers();
    },
    (error) => {
      console.error(error);
      setStatus("No fue posible sincronizar cámaras.", true);
    }
  );
}

async function showMyLocation() {
  try {
    const position = await getCurrentPosition();
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    setStatus(`Ubicación actual: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

    if (mapInitialized) {
      map.setView([lat, lng], 18);
      L.popup().setLatLng([lat, lng]).setContent("📍 Estás aquí").openOn(map);
    }
  } catch (error) {
    console.error(error);
    setStatus("No fue posible obtener tu ubicación.", true);
  }
}

async function centerMapOnLocation() {
  try {
    const position = await getCurrentPosition();
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    initMap();
    map.setView([lat, lng], 18);
    L.popup().setLatLng([lat, lng]).setContent("📍 Ubicación actual").openOn(map);
  } catch (error) {
    console.error(error);
    alert("No fue posible centrar el mapa.");
  }
}

function clearFields() {
  observacionInput.value = "";
  direccionRefInput.value = "";
  setStatus("Campos limpiados.");
}

btnUbicacion.addEventListener("click", showMyLocation);
btnLimpiarCampos.addEventListener("click", clearFields);
btnCentrarMapa.addEventListener("click", centerMapOnLocation);
btnActualizarMapa.addEventListener("click", renderMapMarkers);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch((error) => console.error("SW error:", error));
  });
}
