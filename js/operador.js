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

const categoriaInput = document.getElementById("categoria");
const descripcionInput = document.getElementById("descripcion");
const latitudInput = document.getElementById("latitud");
const longitudInput = document.getElementById("longitud");
const direccionInput = document.getElementById("direccion");
const btnUbicacion = document.getElementById("btnUbicacion");
const registroForm = document.getElementById("registroForm");
const registroMessage = document.getElementById("registroMessage");

let map;
let marker;
let currentUser = null;
let currentProfile = null;
let ubicacionInicialCapturada = false;

requireRole("operador", async (user, profile) => {
  currentUser = user;
  currentProfile = profile;
  userName.textContent = `${profile.nombre || user.email} · ${profile.rol}`;
  initMap();
  bindCategoriaButtons();
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

changePasswordBtn.addEventListener("click", async () => {
  if (!currentUser?.email) {
    alert("No se encontró el correo del usuario.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, currentUser.email);
    alert(`Te envié un correo para cambiar la contraseña a ${currentUser.email}`);
  } catch (error) {
    console.error("Error enviando correo de cambio de contraseña:", error);
    alert("No se pudo enviar el correo para cambiar la contraseña.");
  }
});

function initMap() {
  map = L.map("mapOperador", {
    gestureHandling: true,
    scrollWheelZoom: false
  }).setView([-33.45694, -70.64827], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // Zoom con Ctrl + rueda en PC
  map.getContainer().addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          map.zoomIn();
        } else {
          map.zoomOut();
        }
      }
    },
    { passive: false }
  );

  map.on("click", (e) => {
    if (!ubicacionInicialCapturada) {
      registroMessage.textContent = "Primero debes obtener la ubicación antes de ajustar el punto en el mapa.";
      return;
    }

    const { lat, lng } = e.latlng;
    setLocation(lat, lng, "Ubicación ajustada manualmente en el mapa.");
  });
}

function bindCategoriaButtons() {
  const buttons = document.querySelectorAll(".tile-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      categoriaInput.value = btn.dataset.categoria;
    });
  });
}

function setLocation(lat, lng, message = "") {
  latitudInput.value = Number(lat).toFixed(6);
  longitudInput.value = Number(lng).toFixed(6);

  if (!marker) {
    marker = L.marker([lat, lng]).addTo(map);
  } else {
    marker.setLatLng([lat, lng]);
  }

  map.setView([lat, lng], 17);

  if (message) {
    registroMessage.textContent = message;
  }
}

btnUbicacion.addEventListener("click", () => {
  if (!navigator.geolocation) {
    registroMessage.textContent = "Tu navegador no soporta geolocalización.";
    return;
  }

  registroMessage.textContent = "Obteniendo ubicación...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      ubicacionInicialCapturada = true;
      setLocation(lat, lng, "Ubicación obtenida correctamente. Ahora puedes ajustar el punto en el mapa si es necesario.");
    },
    (error) => {
      console.error(error);
      registroMessage.textContent = "No se pudo obtener la ubicación.";
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
});

registroForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const categoria = categoriaInput.value.trim();
  const descripcion = descripcionInput.value.trim();
  const direccion = direccionInput.value.trim();

  const lat = parseFloat(String(latitudInput.value).replace(",", "."));
  const lng = parseFloat(String(longitudInput.value).replace(",", "."));

  if (!categoria || !descripcion || Number.isNaN(lat) || Number.isNaN(lng)) {
    registroMessage.textContent = "Completa categoría, descripción y captura la ubicación.";
    return;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    registroMessage.textContent = "Las coordenadas no son válidas.";
    return;
  }

  if (lat > -17 || lat < -57 || lng > -66 || lng < -76) {
    registroMessage.textContent = "La ubicación parece estar fuera de Chile. Verifica el punto en el mapa.";
    return;
  }

  registroMessage.textContent = "Guardando incidencia...";

  try {
    await addDoc(collection(db, "incidencias"), {
      categoria,
      descripcion,
      lat,
      lng,
      direccion,
      estado: "pendiente",
      creadoPor: currentUser.uid,
      nombreUsuario: currentProfile.nombre || currentUser.email,
      rolUsuario: currentProfile.rol,
      fecha: serverTimestamp()
    });

    registroMessage.textContent = "Incidencia guardada correctamente.";
    registroForm.reset();
    categoriaInput.value = "";
    ubicacionInicialCapturada = false;

    document.querySelectorAll(".tile-btn").forEach((b) => b.classList.remove("active"));

    latitudInput.value = "";
    longitudInput.value = "";
    direccionInput.value = "";

    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }

    map.setView([-33.45694, -70.64827], 13);
  } catch (error) {
    console.error(error);
    registroMessage.textContent = "Error al guardar la incidencia.";
  }
});
