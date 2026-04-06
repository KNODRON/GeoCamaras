import { auth, db } from "./firebase-config.js";
import { requireRole } from "./guards.js";
import {
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let mostrarResueltos = false;
let mostrarHeatmap = false;

const logoutBtn = document.getElementById("logoutBtn");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const adminName = document.getElementById("adminName");

const statTotal = document.getElementById("statTotal");
const statHoy = document.getElementById("statHoy");
const statPendientes = document.getElementById("statPendientes");
const statResueltas = document.getElementById("statResueltas");

const filtroCategoria = document.getElementById("filtroCategoria");
const filtroEstado = document.getElementById("filtroEstado");
const btnLimpiarFiltros = document.getElementById("btnLimpiarFiltros");
const btnExportarCSV = document.getElementById("btnExportarCSV");
const tablaBody = document.getElementById("tablaIncidenciasBody");
const toggleResueltos = document.getElementById("toggleResueltos");
const toggleHeatmap = document.getElementById("toggleHeatmap");

const btnVistaMapa = document.getElementById("btnVistaMapa");
const btnVistaListado = document.getElementById("btnVistaListado");
const btnVolverMapa = document.getElementById("btnVolverMapa");
const vistaMapa = document.getElementById("vistaMapa");
const vistaListado = document.getElementById("vistaListado");

const btnMapaBase = document.getElementById("btnMapaBase");
const btnMapaSatelital = document.getElementById("btnMapaSatelital");

let map;
let markersLayer;
let heatLayer = null;
let allIncidencias = [];
let currentUser = null;
let baseLayer;
let satLayer;

requireRole("admin", async (user, profile) => {
  currentUser = user;
  adminName.textContent = `${profile.nombre || user.email} · Administrador`;
  initMap();
  bindEvents();
  await loadIncidencias();
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

function bindEvents() {
  filtroCategoria.addEventListener("change", renderAll);
  filtroEstado.addEventListener("change", renderAll);

  btnLimpiarFiltros.addEventListener("click", () => {
    filtroCategoria.value = "";
    filtroEstado.value = "";
    renderAll();
  });

  btnExportarCSV.addEventListener("click", () => {
    exportarCSV(getFilteredIncidencias());
  });

  if (toggleResueltos) {
    toggleResueltos.addEventListener("change", (e) => {
      mostrarResueltos = e.target.checked;
      renderAll();
    });
  }

  if (toggleHeatmap) {
    toggleHeatmap.addEventListener("change", (e) => {
      mostrarHeatmap = e.target.checked;
      renderAll();
    });
  }

  btnVistaMapa.addEventListener("click", () => activarVista("mapa"));
  btnVistaListado.addEventListener("click", () => activarVista("listado"));
  btnVolverMapa.addEventListener("click", () => activarVista("mapa"));

  btnMapaBase.addEventListener("click", activarMapaBase);
  btnMapaSatelital.addEventListener("click", activarMapaSatelital);
}

function activarVista(vista) {
  vistaMapa.classList.remove("active");
  vistaListado.classList.remove("active");
  btnVistaMapa.classList.remove("active-view-btn");
  btnVistaListado.classList.remove("active-view-btn");

  if (vista === "mapa") {
    vistaMapa.classList.add("active");
    btnVistaMapa.classList.add("active-view-btn");
    setTimeout(() => map.invalidateSize(), 150);
  } else {
    vistaListado.classList.add("active");
    btnVistaListado.classList.add("active-view-btn");
  }
}

function initMap() {
  map = L.map("mapAdmin", {
    gestureHandling: true,
    scrollWheelZoom: false
  }).setView([-33.45694, -70.64827], 12);

  baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  });

  satLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri"
    }
  );

  baseLayer.addTo(map);

  map.getContainer().addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) map.zoomIn();
        else map.zoomOut();
      }
    },
    { passive: false }
  );

  markersLayer = L.layerGroup().addTo(map);
}

function activarMapaBase() {
  if (map.hasLayer(satLayer)) map.removeLayer(satLayer);
  if (!map.hasLayer(baseLayer)) baseLayer.addTo(map);
  btnMapaBase.classList.add("active-view-btn");
  btnMapaSatelital.classList.remove("active-view-btn");
}

function activarMapaSatelital() {
  if (map.hasLayer(baseLayer)) map.removeLayer(baseLayer);
  if (!map.hasLayer(satLayer)) satLayer.addTo(map);
  btnMapaSatelital.classList.add("active-view-btn");
  btnMapaBase.classList.remove("active-view-btn");
}

async function loadIncidencias() {
  try {
    const q = query(collection(db, "incidencias"), orderBy("fecha", "desc"));
    const snapshot = await getDocs(q);

    allIncidencias = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    renderAll();
  } catch (error) {
    console.error("Error cargando incidencias:", error);
  }
}

function getFilteredIncidencias() {
  const categoria = filtroCategoria.value;
  const estado = filtroEstado.value;

  return allIncidencias.filter((item) => {
    const okCategoria = !categoria || item.categoria === categoria;
    const okEstado = !estado || item.estado === estado;
    return okCategoria && okEstado;
  });
}

function getMapIncidencias(items) {
  return items.filter((item) => {
    if (!mostrarResueltos && item.estado === "resuelto") return false;
    if (!coordenadasValidas(item)) return false;
    return true;
  });
}

function renderAll() {
  const filtered = getFilteredIncidencias();
  const mapItems = getMapIncidencias(filtered);

  renderStats(filtered);
  renderTable(filtered);
  renderMap(mapItems);
  renderHeatmap(mapItems);
}

function renderStats(items) {
  statTotal.textContent = items.length;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const totalHoy = items.filter((item) => {
    if (!item.fecha) return false;
    const fecha = item.fecha.toDate ? item.fecha.toDate() : new Date(item.fecha);
    return fecha >= hoy;
  }).length;

  statHoy.textContent = totalHoy;
  statPendientes.textContent = items.filter((i) => i.estado === "pendiente").length;
  statResueltas.textContent = items.filter((i) => i.estado === "resuelto").length;
}

function aplicarColorEstado(select) {
  const estado = select.value;

  select.style.backgroundColor = "";
  select.style.color = "";
  select.style.borderColor = "";
  select.style.fontWeight = "700";

  if (estado === "pendiente") {
    select.style.backgroundColor = "#ffe5e5";
    select.style.color = "#b30000";
    select.style.borderColor = "#ef9a9a";
  } else if (estado === "en_proceso") {
    select.style.backgroundColor = "#fff4e5";
    select.style.color = "#b36b00";
    select.style.borderColor = "#f2c078";
  } else if (estado === "resuelto") {
    select.style.backgroundColor = "#e6ffed";
    select.style.color = "#006b2e";
    select.style.borderColor = "#86d7a0";
  }
}

function coordenadasValidas(item) {
  return (
    typeof item.lat === "number" &&
    typeof item.lng === "number" &&
    !isNaN(item.lat) &&
    !isNaN(item.lng) &&
    item.lat !== 0 &&
    item.lng !== 0
  );
}

function renderTable(items) {
  tablaBody.innerHTML = "";

  if (!items.length) {
    tablaBody.innerHTML = `
      <tr>
        <td colspan="7">No hay incidencias para mostrar.</td>
      </tr>
    `;
    return;
  }

  items.forEach((item) => {
    const tr = document.createElement("tr");
    const tieneCoordenadas = coordenadasValidas(item);

    tr.innerHTML = `
      <td>${safe(item.categoria)}</td>
      <td>${safe(item.descripcion)}</td>
      <td>${safe(item.direccion || "-")}</td>
      <td>
        <select class="estado-select" data-id="${item.id}">
          <option value="pendiente" ${item.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
          <option value="en_proceso" ${item.estado === "en_proceso" ? "selected" : ""}>En proceso</option>
          <option value="resuelto" ${item.estado === "resuelto" ? "selected" : ""}>Resuelto</option>
        </select>
      </td>
      <td>${formatFecha(item.fecha)}</td>
      <td>${safe(item.nombreUsuario || "-")}</td>
      <td>
        ${
          tieneCoordenadas
            ? `<button
                type="button"
                class="btn-ver-mapa"
                data-lat="${item.lat}"
                data-lng="${item.lng}"
                data-categoria="${safe(item.categoria)}"
                data-descripcion="${safe(item.descripcion)}"
                data-direccion="${safe(item.direccion || "-")}"
              >Ver</button>`
            : `<span class="sin-punto">Sin punto</span>`
        }
      </td>
    `;

    tablaBody.appendChild(tr);
  });

  document.querySelectorAll(".estado-select").forEach((select) => {
    aplicarColorEstado(select);

    select.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const nuevoEstado = e.target.value;

      aplicarColorEstado(e.target);

      try {
        await updateDoc(doc(db, "incidencias", id), {
          estado: nuevoEstado
        });
        await loadIncidencias();
      } catch (error) {
        console.error("Error actualizando estado:", error);
        alert("No se pudo actualizar el estado.");
      }
    });
  });

  document.querySelectorAll(".btn-ver-mapa").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);

      if (isNaN(lat) || isNaN(lng)) {
        alert("Esta incidencia no tiene ubicación válida.");
        return;
      }

      activarVista("mapa");
      map.setView([lat, lng], 18);

      L.popup()
        .setLatLng([lat, lng])
        .setContent(`
          <strong>${btn.dataset.categoria}</strong><br>
          ${btn.dataset.descripcion}<br>
          <strong>Dirección:</strong> ${btn.dataset.direccion}
        `)
        .openOn(map);
    });
  });
}

function renderMap(items) {
  markersLayer.clearLayers();

  if (!items.length) return;

  const bounds = [];

  items.forEach((item) => {
    let color = "#ef4444";
    if (item.estado === "en_proceso") color = "#f59e0b";
    if (item.estado === "resuelto") color = "#22c55e";

    const marker = L.circleMarker([item.lat, item.lng], {
      radius: 8,
      fillColor: color,
      color: "#111827",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.85
    }).bindPopup(`
      <strong>${safe(item.categoria)}</strong><br>
      ${safe(item.descripcion)}<br>
      <strong>Estado:</strong> ${safe(item.estado)}<br>
      <strong>Dirección:</strong> ${safe(item.direccion || "-")}
    `);

    marker.addTo(markersLayer);
    bounds.push([item.lat, item.lng]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}

function renderHeatmap(items) {
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }

  if (!mostrarHeatmap || !items.length) return;

  const heatPoints = items.map((item) => {
    let intensity = 0.7;
    if (item.estado === "pendiente") intensity = 1.0;
    if (item.estado === "en_proceso") intensity = 0.8;
    if (item.estado === "resuelto") intensity = 0.4;

    return [item.lat, item.lng, intensity];
  });

  heatLayer = L.heatLayer(heatPoints, {
    radius: 28,
    blur: 20,
    maxZoom: 17,
    minOpacity: 0.35,
    gradient: {
      0.2: "#3b82f6",
      0.4: "#22c55e",
      0.6: "#f59e0b",
      0.8: "#ef4444"
    }
  });

  heatLayer.addTo(map);
}

function formatFecha(timestamp) {
  if (!timestamp) return "-";
  const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return fecha.toLocaleString("es-CL");
}

function safe(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function exportarCSV(items) {
  const headers = ["Categoria", "Descripcion", "Direccion", "Estado", "Fecha", "Usuario", "Lat", "Lng"];

  const rows = items.map((item) => [
    item.categoria || "",
    item.descripcion || "",
    item.direccion || "",
    item.estado || "",
    formatFecha(item.fecha),
    item.nombreUsuario || "",
    item.lat || "",
    item.lng || ""
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
    )
    .join("\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "georegistro_incidencias.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
