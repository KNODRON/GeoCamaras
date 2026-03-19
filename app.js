const STORAGE_KEY = "geocamaras_registros_v1";

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const typeButtons = document.querySelectorAll(".type-btn");

const observacionInput = document.getElementById("observacion");
const direccionRefInput = document.getElementById("direccionRef");
const statusBox = document.getElementById("statusBox");
const recordsList = document.getElementById("recordsList");

const btnUbicacion = document.getElementById("btnUbicacion");
const btnLimpiarCampos = document.getElementById("btnLimpiarCampos");
const btnCentrarMapa = document.getElementById("btnCentrarMapa");
const btnActualizarMapa = document.getElementById("btnActualizarMapa");
const btnExportar = document.getElementById("btnExportar");
const btnBorrarTodo = document.getElementById("btnBorrarTodo");

let map = null;
let markersLayer = null;
let mapInitialized = false;

function getRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    console.error("Error leyendo registros:", error);
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.style.color = isError ? "#b91c1c" : "#374151";
  statusBox.style.borderColor = isError ? "#fecaca" : "#e5e7eb";
  statusBox.style.background = isError ? "#fef2f2" : "#f9fafb";
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString("es-CL");
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

  if (tabName === "registros") {
    renderRecordsList();
  }
}

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
    setStatus(`Obteniendo ubicación para registrar: ${type}...`);

    const position = await getCurrentPosition();
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    const observacion = observacionInput.value.trim();
    const referencia = direccionRefInput.value.trim();

    const record = {
      id: Date.now(),
      type,
      lat,
      lng,
      observacion,
      referencia,
      createdAt: new Date().toISOString()
    };

    const records = getRecords();
    records.push(record);
    saveRecords(records);

    setStatus(
      `Registro guardado: ${type} (${lat.toFixed(6)}, ${lng.toFixed(6)})`
    );

    renderRecordsList();

    if (mapInitialized) {
      renderMapMarkers();
    }
  } catch (error) {
    console.error(error);

    let message = "No se pudo obtener la ubicación.";
    if (error.code === 1) message = "Permiso de ubicación denegado.";
    if (error.code === 2) message = "Ubicación no disponible.";
    if (error.code === 3) message = "Tiempo de espera agotado.";

    setStatus(message, true);
  }
}

function renderRecordsList() {
  const records = getRecords().slice().reverse();

  if (records.length === 0) {
    recordsList.innerHTML = `
      <div class="empty-box">Aún no hay registros guardados.</div>
    `;
    return;
  }

  recordsList.innerHTML = records
    .map(
      (record) => `
        <div class="record-item">
          <div class="record-title">${getEmoji(record.type)} ${record.type}</div>
          <small><strong>Fecha:</strong> ${formatDate(record.createdAt)}</small>
          <small><strong>Lat:</strong> ${record.lat.toFixed(6)}</small>
          <small><strong>Lng:</strong> ${record.lng.toFixed(6)}</small>
          <small><strong>Referencia:</strong> ${record.referencia || "-"}</small>
          <small><strong>Observación:</strong> ${record.observacion || "-"}</small>
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
  renderMapMarkers();
}

function renderMapMarkers() {
  if (!mapInitialized) return;

  markersLayer.clearLayers();
  const records = getRecords();

  if (records.length === 0) return;

  const bounds = [];

  records.forEach((record) => {
    const popupHtml = `
      <strong>${getEmoji(record.type)} ${record.type}</strong><br>
      Fecha: ${formatDate(record.createdAt)}<br>
      Referencia: ${record.referencia || "-"}<br>
      Observación: ${record.observacion || "-"}<br>
      Lat: ${record.lat.toFixed(6)}<br>
      Lng: ${record.lng.toFixed(6)}
    `;

    const marker = L.marker([record.lat, record.lng]).bindPopup(popupHtml);
    marker.addTo(markersLayer);
    bounds.push([record.lat, record.lng]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}

async function showMyLocation() {
  try {
    setStatus("Buscando ubicación...");
    const position = await getCurrentPosition();
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    setStatus(`Ubicación actual: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

    if (mapInitialized) {
      map.setView([lat, lng], 18);
      L.popup()
        .setLatLng([lat, lng])
        .setContent("📍 Estás aquí")
        .openOn(map);
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

    L.popup()
      .setLatLng([lat, lng])
      .setContent("📍 Ubicación actual")
      .openOn(map);
  } catch (error) {
    console.error(error);
    alert("No fue posible centrar el mapa en tu ubicación.");
  }
}

function clearFields() {
  observacionInput.value = "";
  direccionRefInput.value = "";
  setStatus("Campos limpiados.");
}

function exportJSON() {
  const records = getRecords();

  if (records.length === 0) {
    alert("No hay registros para exportar.");
    return;
  }

  const blob = new Blob([JSON.stringify(records, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "geocamaras_registros.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function deleteAllRecords() {
  const confirmed = confirm("¿Seguro que deseas borrar todos los registros?");
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);
  renderRecordsList();
  if (mapInitialized) renderMapMarkers();
  setStatus("Todos los registros fueron eliminados.");
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

typeButtons.forEach((btn) => {
  btn.addEventListener("click", () => registerCamera(btn.dataset.type));
});

btnUbicacion.addEventListener("click", showMyLocation);
btnLimpiarCampos.addEventListener("click", clearFields);
btnCentrarMapa.addEventListener("click", centerMapOnLocation);
btnActualizarMapa.addEventListener("click", renderMapMarkers);
btnExportar.addEventListener("click", exportJSON);
btnBorrarTodo.addEventListener("click", deleteAllRecords);

renderRecordsList();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch((error) => console.error("SW error:", error));
  });
}
