import { auth, db } from "./firebase-config.js";
import { requireRole } from "./guards.js";
import {
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const logoutBtn = document.getElementById("logoutBtn");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const userName = document.getElementById("userName");

const togglePanelOperador = document.getElementById("togglePanelOperador");
const btnPanelFloating = document.getElementById("btnPanelFloating");
const btnUbicacionFloating = document.getElementById("btnUbicacionFloating");
const panelOperador = document.getElementById("panelOperador");

const categoriaInput = document.getElementById("categoria");
const descripcionInput = document.getElementById("descripcion");
const latitudInput = document.getElementById("latitud");
const longitudInput = document.getElementById("longitud");
const direccionInput = document.getElementById("direccion");
const btnUbicacion = document.getElementById("btnUbicacion");
const registroForm = document.getElementById("registroForm");
const registroMessage = document.getElementById("registroMessage");

const installPwaBanner = document.getElementById("installPwaBanner");
const installPwaBtn = document.getElementById("installPwaBtn");
const installPwaDismiss = document.getElementById("installPwaDismiss");
const installPwaText = document.getElementById("installPwaText");

let map;
let marker;
let currentUser = null;
let currentProfile = null;
let ubicacionInicialCapturada = false;
let panelInicializado = false;
let deferredInstallPrompt = null;

requireRole("operador", async (user, profile) => {
  currentUser = user;
  currentProfile = profile;

  if (userName) {
    userName.textContent = `${profile.nombre || user.email} · ${profile.rol}`;
  }

  initMap();
  bindCategoriaButtons();
  bindBottomSheet();
  bindUIEvents();
  bindPwaInstallEvents();
});

function bindUIEvents() {
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "./login.html";
    });
  }

  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", async () => {
      if (!currentUser?.email) {
        setFormMessage("No se encontró el correo del usuario.", "error");
        return;
      }

      try {
        await sendPasswordResetEmail(auth, currentUser.email);
        setFormMessage(`Se envió un correo para cambiar la contraseña a ${currentUser.email}.`, "success");
      } catch (error) {
        console.error("Error enviando correo de cambio de contraseña:", error);
        setFormMessage("No se pudo enviar el correo para cambiar la contraseña.", "error");
      }
    });
  }

  if (togglePanelOperador) {
    togglePanelOperador.addEventListener("click", togglePanel);
  }

  if (btnPanelFloating) {
    btnPanelFloating.addEventListener("click", togglePanel);
  }

  if (btnUbicacion) {
    btnUbicacion.addEventListener("click", obtenerUbicacion);
  }

  if (btnUbicacionFloating) {
    btnUbicacionFloating.addEventListener("click", obtenerUbicacion);
  }

  if (registroForm) {
    registroForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const categoria = categoriaInput?.value.trim() || "";
      const descripcion = descripcionInput?.value.trim() || "";
      const estado = "pendiente";
      const direccion = direccionInput?.value.trim() || "";

      const lat = parseFloat(String(latitudInput?.value || "").replace(",", "."));
      const lng = parseFloat(String(longitudInput?.value || "").replace(",", "."));

      if (!categoria || !descripcion || Number.isNaN(lat) || Number.isNaN(lng)) {
        setFormMessage("Completa categoría, descripción y captura la ubicación.", "error");
        return;
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        setFormMessage("Las coordenadas no son válidas.", "error");
        return;
      }

      if (lat > -17 || lat < -57 || lng > -66 || lng < -76) {
        setFormMessage("La ubicación parece estar fuera de Chile. Verifica el punto en el mapa.", "error");
        return;
      }

      setFormMessage("Guardando incidencia...", "info");

      try {
        await addDoc(collection(db, "incidencias"), {
          categoria,
          descripcion,
          lat,
          lng,
          direccion,
          estado,
          creadoPor: currentUser.uid,
          nombreUsuario: currentProfile.nombre || currentUser.email,
          rolUsuario: currentProfile.rol,
          fecha: serverTimestamp()
        });

        resetFormulario();
        closePanel();
        setFormMessage("Incidencia registrada correctamente.", "success");
      } catch (error) {
        console.error(error);
        setFormMessage("Error al guardar la incidencia.", "error");
      }
    });
  }
}

function togglePanel() {
  if (!panelOperador) return;
  panelOperador.classList.toggle("open");
  refreshMap();
}

function openPanel() {
  if (!panelOperador) return;
  panelOperador.classList.add("open");
  refreshMap();
}

function closePanel() {
  if (!panelOperador) return;
  panelOperador.classList.remove("open");
  refreshMap();
}

function refreshMap() {
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 280);
}

function bindBottomSheet() {
  if (panelInicializado || !panelOperador) return;
  panelInicializado = true;

  let startY = 0;
  let endY = 0;

  const handle = panelOperador.querySelector(".sheet-handle");
  if (!handle) return;

  const onStart = (clientY) => {
    startY = clientY;
  };

  const onEnd = (clientY) => {
    endY = clientY;
    const diff = endY - startY;

    if (diff > 60) {
      closePanel();
    } else if (diff < -40) {
      openPanel();
    }
  };

  handle.addEventListener("touchstart", (e) => onStart(e.touches[0].clientY), { passive: true });
  handle.addEventListener("touchend", (e) => onEnd(e.changedTouches[0].clientY), { passive: true });
}

function initMap() {
  const esMovil = window.matchMedia("(max-width: 1024px)").matches;

  map = L.map("mapOperador", {
    gestureHandling: !esMovil,
    scrollWheelZoom: esMovil,
    zoomControl: false
  }).setView([-33.45694, -70.64827], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // Dejamos zoom visible también en móvil
  L.control.zoom({ position: "topleft" }).addTo(map);

  map.on("click", (e) => {
    if (!ubicacionInicialCapturada) {
      setFormMessage("Primero debes obtener la ubicación antes de ajustar el punto en el mapa.", "info");
      return;
    }

    const { lat, lng } = e.latlng;
    setLocation(lat, lng, "Ubicación ajustada manualmente en el mapa.");
  });

  setTimeout(() => map.invalidateSize(), 400);
}

function bindCategoriaButtons() {
  const buttons = document.querySelectorAll(".tile-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (categoriaInput) categoriaInput.value = btn.dataset.categoria;
      openPanel();
    });
  });
}

function setLocation(lat, lng, message = "") {
  if (latitudInput) latitudInput.value = Number(lat).toFixed(6);
  if (longitudInput) longitudInput.value = Number(lng).toFixed(6);

  if (!marker) {
    marker = L.marker([lat, lng], { draggable: true }).addTo(map);

    marker.on("dragend", (e) => {
      const pos = e.target.getLatLng();
      if (latitudInput) latitudInput.value = Number(pos.lat).toFixed(6);
      if (longitudInput) longitudInput.value = Number(pos.lng).toFixed(6);
      setFormMessage("Ubicación ajustada manualmente en el mapa.", "info");
    });
  } else {
    marker.setLatLng([lat, lng]);
  }

  map.setView([lat, lng], 17);

  if (message) {
    setFormMessage(message, "success");
  }
}

function obtenerUbicacion() {
  if (!navigator.geolocation) {
    setFormMessage("Tu navegador no soporta geolocalización.", "error");
    return;
  }

  setFormMessage("Obteniendo ubicación...", "info");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      ubicacionInicialCapturada = true;

      setLocation(
        lat,
        lng,
        "Ubicación obtenida correctamente. Ahora puedes ajustar el punto en el mapa si es necesario."
      );

      openPanel();
    },
    (error) => {
      console.error(error);
      setFormMessage("No se pudo obtener la ubicación.", "error");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function resetFormulario() {
  if (registroForm) registroForm.reset();
  if (categoriaInput) categoriaInput.value = "";
  if (direccionInput) direccionInput.value = "";
  if (latitudInput) latitudInput.value = "";
  if (longitudInput) longitudInput.value = "";

  ubicacionInicialCapturada = false;

  document.querySelectorAll(".tile-btn").forEach((b) => b.classList.remove("active"));

  if (marker) {
    map.removeLayer(marker);
    marker = null;
  }

  map.setView([-33.45694, -70.64827], 13);
}

function setFormMessage(message, type = "info") {
  if (!registroMessage) return;
  registroMessage.textContent = message;
  registroMessage.dataset.state = type;
}

function bindPwaInstallEvents() {
  if (!installPwaBanner || !installPwaBtn || !installPwaDismiss || !installPwaText) return;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    installPwaBanner.classList.remove("show");
    return;
  }

  installPwaDismiss.addEventListener("click", () => {
    installPwaBanner.classList.remove("show");
  });

  installPwaBtn.addEventListener("click", instalarPwa);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installPwaBtn.style.display = "";
    installPwaText.textContent = "Agrega esta app al inicio para abrir directo el panel operador.";
    installPwaBanner.classList.add("show");
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installPwaBanner.classList.remove("show");
    setFormMessage("GeoRegistro quedó instalado en este equipo.", "success");
  });

  // Si el navegador no entrega el evento, igual mostramos la ayuda
  installPwaBtn.style.display = "none";
  installPwaText.textContent = "Si no aparece el botón, usa el menú del navegador y selecciona “Agregar a pantalla de inicio”.";
  installPwaBanner.classList.add("show");
}

async function instalarPwa() {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  const result = await deferredInstallPrompt.userChoice;

  if (result.outcome === "accepted") {
    installPwaBanner.classList.remove("show");
  }

  deferredInstallPrompt = null;
}
