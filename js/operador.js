// =========================
// PWA INSTALL
// =========================

let deferredInstallPrompt = null;

const installBanner = document.getElementById("installPwaBanner");
const installBtn = document.getElementById("installPwaBtn");
const installDismiss = document.getElementById("installPwaDismiss");

// Detecta si ya está instalada
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

if (isStandalone) {
  if (installBanner) installBanner.style.display = "none";
}

// Evento real de instalación
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;

  if (installBanner) {
    installBanner.classList.add("show");
  }
});

// Click instalar
if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;

    if (result.outcome === "accepted") {
      installBanner.classList.remove("show");
    }

    deferredInstallPrompt = null;
  });
}

// Cerrar banner
if (installDismiss) {
  installDismiss.addEventListener("click", () => {
    installBanner.classList.remove("show");
  });
}

// Cuando se instala
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (installBanner) installBanner.classList.remove("show");
});


// =========================
// MAPA + FUNCIONALIDAD BASE
// =========================

let map;
let marker = null;

function initMap() {
  map = L.map("mapOperador").setView([-33.45, -70.65], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(map);

  map.on("click", (e) => {
    setMarker(e.latlng.lat, e.latlng.lng);
  });
}

function setMarker(lat, lng) {
  if (!marker) {
    marker = L.marker([lat, lng], { draggable: true }).addTo(map);
  } else {
    marker.setLatLng([lat, lng]);
  }

  document.getElementById("latitud").value = lat.toFixed(6);
  document.getElementById("longitud").value = lng.toFixed(6);
}


// =========================
// UBICACIÓN
// =========================

document.getElementById("btnUbicacion")?.addEventListener("click", () => {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      setMarker(lat, lng);
      map.setView([lat, lng], 17);
    },
    () => {
      console.log("Error obteniendo ubicación");
    }
  );
});


// =========================
// INICIO
// =========================

document.addEventListener("DOMContentLoaded", () => {
  initMap();
});
