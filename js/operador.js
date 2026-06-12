import { auth, db } from "./firebase-config.js";
import { requireRole } from "./guards.js";
import {
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const logoutBtn = document.getElementById("logoutBtn");
const userName = document.getElementById("userName");

const btnNuevoRegistro = document.getElementById("btnNuevoRegistro");
const btnNuevoDesdeExito = document.getElementById("btnNuevoDesdeExito");
const btnCerrarExito = document.getElementById("btnCerrarExito");
const btnCerrarWizard = document.getElementById("btnCerrarWizard");

const wizard = document.getElementById("wizard");
const successScreen = document.getElementById("successScreen");

const wizardStepText = document.getElementById("wizardStepText");
const wizardTitle = document.getElementById("wizardTitle");
const progressBar = document.getElementById("progressBar");

const stepCategoria = document.getElementById("stepCategoria");
const stepGps = document.getElementById("stepGps");
const stepDescripcion = document.getElementById("stepDescripcion");
const stepResumen = document.getElementById("stepResumen");

const gpsIcon = document.getElementById("gpsIcon");
const gpsTitle = document.getElementById("gpsTitle");
const gpsText = document.getElementById("gpsText");
const gpsAccuracy = document.getElementById("gpsAccuracy");
const btnReintentarGps = document.getElementById("btnReintentarGps");
const btnGpsContinuar = document.getElementById("btnGpsContinuar");

const descripcionInput = document.getElementById("descripcion");
const direccionInput = document.getElementById("direccion");
const btnDescripcionContinuar = document.getElementById("btnDescripcionContinuar");
const btnGuardar = document.getElementById("btnGuardar");

const resCategoria = document.getElementById("resCategoria");
const resUbicacion = document.getElementById("resUbicacion");
const resDescripcion = document.getElementById("resDescripcion");

const registroMessage = document.getElementById("registroMessage");

let currentUser = null;
let currentProfile = null;

let map = null;
let marker = null;

let pasoActual = 1;

const registro = {
  categoria: "",
  descripcion: "",
  direccion: "",
  lat: null,
  lng: null,
  precision: null
};

requireRole("operador", async (user, profile) => {
  currentUser = user;
  currentProfile = profile;

  if (userName) {
    userName.textContent = `${profile.nombre || user.email} · ${profile.rol}`;
  }

  initMap();
  bindEventos();
});

function bindEventos() {
  logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "./login.html";
  });

  btnNuevoRegistro?.addEventListener("click", iniciarRegistro);
  btnNuevoDesdeExito?.addEventListener("click", iniciarRegistro);

  btnCerrarWizard?.addEventListener("click", cerrarWizard);
  btnCerrarExito?.addEventListener("click", cerrarExito);

  document.querySelectorAll(".categoria-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".categoria-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      registro.categoria = btn.dataset.categoria || "";
      irPaso(2);
      obtenerGpsAutomatico();
    });
  });

  btnReintentarGps?.addEventListener("click", obtenerGpsAutomatico);

  btnGpsContinuar?.addEventListener("click", () => {
    if (!registro.lat || !registro.lng) {
      setMessage("Primero debe capturarse la ubicación.", "error");
      return;
    }

    irPaso(3);
  });

  btnDescripcionContinuar?.addEventListener("click", () => {
    const descripcion = descripcionInput.value.trim();
    const direccion = direccionInput.value.trim();

    if (descripcion.length < 5) {
      setMessage("Ingrese una descripción breve de la incidencia.", "error");
      return;
    }

    registro.descripcion = descripcion;
    registro.direccion = direccion;

    cargarResumen();
    irPaso(4);
  });

  btnGuardar?.addEventListener("click", guardarIncidencia);
}

function initMap() {
  map = L.map("mapOperador", {
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true
  }).setView([-33.45694, -70.64827], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 1,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  setTimeout(() => {
    map.invalidateSize();
  }, 300);
}

function iniciarRegistro() {
  limpiarRegistro();

  successScreen.classList.add("hidden");
  wizard.classList.remove("hidden");

  irPaso(1);

  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 250);
}

function cerrarWizard() {
  wizard.classList.add("hidden");
  setMessage("");
}

function cerrarExito() {
  successScreen.classList.add("hidden");
}

function irPaso(paso) {
  pasoActual = paso;

  stepCategoria.classList.remove("active");
  stepGps.classList.remove("active");
  stepDescripcion.classList.remove("active");
  stepResumen.classList.remove("active");

  const titulos = {
    1: "Categoría",
    2: "Ubicación GPS",
    3: "Descripción",
    4: "Resumen"
  };

  const steps = {
    1: stepCategoria,
    2: stepGps,
    3: stepDescripcion,
    4: stepResumen
  };

  steps[paso].classList.add("active");

  wizardStepText.textContent = `Paso ${paso} de 4`;
  wizardTitle.textContent = titulos[paso];
  progressBar.style.width = `${paso * 25}%`;

  setMessage("");
}

function obtenerGpsAutomatico() {
  if (!navigator.geolocation) {
    gpsFallido("Este teléfono no soporta geolocalización.");
    return;
  }

  gpsIcon.textContent = "📍";
  gpsTitle.textContent = "Obteniendo ubicación...";
  gpsText.textContent = "Mantenga el teléfono con señal GPS.";
  gpsAccuracy.textContent = "";

  btnReintentarGps.classList.add("hidden");
  btnGpsContinuar.classList.add("hidden");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const precision = Math.round(position.coords.accuracy || 0);

      if (!coordenadasChile(lat, lng)) {
        gpsFallido("La ubicación parece estar fuera de Chile. Verifique el GPS.");
        return;
      }

      registro.lat = lat;
      registro.lng = lng;
      registro.precision = precision;

      pintarMarker(lat, lng);

      gpsIcon.textContent = "✅";
      gpsTitle.textContent = "Ubicación capturada";
      gpsText.textContent = "GPS listo para registrar la incidencia.";
      gpsAccuracy.textContent = precision ? `Precisión aproximada: ${precision} m` : "";

      btnGpsContinuar.classList.remove("hidden");
    },
    (error) => {
      console.error(error);
      gpsFallido("No se pudo obtener la ubicación. Revise permisos GPS.");
    },
    {
      enableHighAccuracy: true,
      timeout: 9000,
      maximumAge: 15000
    }
  );
}

function gpsFallido(mensaje) {
  gpsIcon.textContent = "⚠️";
  gpsTitle.textContent = "GPS no disponible";
  gpsText.textContent = mensaje;
  gpsAccuracy.textContent = "";

  btnReintentarGps.classList.remove("hidden");
  btnGpsContinuar.classList.add("hidden");
}

function pintarMarker(lat, lng) {
  if (!map) return;

  if (!marker) {
    marker = L.marker([lat, lng]).addTo(map);
  } else {
    marker.setLatLng([lat, lng]);
  }

  map.setView([lat, lng], 17);
}

function cargarResumen() {
  resCategoria.textContent = registro.categoria || "-";

  if (registro.precision) {
    resUbicacion.textContent = `GPS capturado · precisión ${registro.precision} m`;
  } else {
    resUbicacion.textContent = "GPS capturado";
  }

  resDescripcion.textContent = registro.descripcion || "-";
}

async function guardarIncidencia() {
  if (!registro.categoria || !registro.descripcion || !registro.lat || !registro.lng) {
    setMessage("Faltan datos para guardar la incidencia.", "error");
    return;
  }

  btnGuardar.disabled = true;
  btnGuardar.textContent = "Guardando...";
  setMessage("Enviando registro...", "info");

  try {
    await addDoc(collection(db, "incidencias"), {
      categoria: registro.categoria,
      descripcion: registro.descripcion,
      direccion: registro.direccion || "",
      lat: Number(registro.lat),
      lng: Number(registro.lng),
      precisionGps: registro.precision || null,
      estado: "pendiente",
      creadoPor: currentUser.uid,
      nombreUsuario: currentProfile.nombre || currentUser.email,
      rolUsuario: currentProfile.rol,
      fecha: serverTimestamp()
    });

    wizard.classList.add("hidden");
    successScreen.classList.remove("hidden");

    limpiarRegistro();
  } catch (error) {
    console.error(error);
    setMessage("No se pudo guardar la incidencia.", "error");
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = "Guardar incidencia";
  }
}

function limpiarRegistro() {
  registro.categoria = "";
  registro.descripcion = "";
  registro.direccion = "";
  registro.lat = null;
  registro.lng = null;
  registro.precision = null;

  descripcionInput.value = "";
  direccionInput.value = "";

  document.querySelectorAll(".categoria-btn").forEach((btn) => btn.classList.remove("active"));

  if (marker && map) {
    map.removeLayer(marker);
    marker = null;
  }

  if (map) {
    map.setView([-33.45694, -70.64827], 13);
  }

  btnGuardar.disabled = false;
  btnGuardar.textContent = "Guardar incidencia";

  setMessage("");
}

function coordenadasChile(lat, lng) {
  return lat <= -17 && lat >= -57 && lng <= -66 && lng >= -76;
}

function setMessage(message, type = "info") {
  if (!registroMessage) return;

  registroMessage.textContent = message || "";
  registroMessage.dataset.state = type;
}
