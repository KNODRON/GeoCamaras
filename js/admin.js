import { auth, db } from "./firebase-config.js";
import { requireRole } from "./guards.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const logoutBtn = document.getElementById("logoutBtn");
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

let map;
let markersLayer;
let allIncidencias = [];

requireRole("admin", async (user, profile) => {
  adminName.textContent = `${profile.nombre || user.email} · Administrador`;
  initMap();
  await loadIncidencias();
  bindEvents();
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
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
    const filtered = getFilteredIncidencias();
    exportarCSV(filtered);
  });
}

function initMap() {
  map = L.map("mapAdmin").setView([-33.45694, -70.64827], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
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

function renderAll() {
  const filtered = getFilteredIncidencias();
  renderStats(filtered);
  renderTable(filtered);
  renderMap(filtered);
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

  const pendientes = items.filter((item) => item.estado === "pendiente").length;
  const resueltas = items.filter((item) => item.estado === "resuelto").length;

  statHoy.textContent = totalHoy;
  statPendientes.textContent = pendientes;
  statResueltas.textContent = resueltas;
}

function renderTable(items) {
  tablaBody.innerHTML = "";

  if (!items.length) {
    tablaBody.innerHTML = `
      <tr>
        <td colspan="6">No hay incidencias para mostrar.</td>
      </tr>
    `;
    return;
  }

  items.forEach((item) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${safe(item.categoria)}</td>
      <td>${safe(item.descripcion)}</td>
      <td>${safe(item.direccion || "-")}</td>
      <td>${renderEstado(item.estado || "pendiente")}</td>
      <td>${formatFecha(item.fecha)}</td>
      <td>${safe(item.nombreUsuario || "-")}</td>
    `;

    tablaBody.appendChild(tr);
  });
}

function renderEstado(estado) {
  const clean = safe(estado);
  return `<span class="estado-badge estado-${clean}">${clean}</span>`;
}

function renderMap(items) {
  markersLayer.clearLayers();

  if (!items.length) return;

  const bounds = [];

  items.forEach((item) => {
    if (typeof item.lat !== "number" || typeof item.lng !== "number") return;

    const marker = L.marker([item.lat, item.lng]).bindPopup(`
      <strong>${safe(item.categoria)}</strong><br>
      ${safe(item.descripcion)}<br>
      <strong>Estado:</strong> ${safe(item.estado || "pendiente")}<br>
      <strong>Dirección:</strong> ${safe(item.direccion || "-")}
    `);

    marker.addTo(markersLayer);
    bounds.push([item.lat, item.lng]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
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
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "georegistro_incidencias.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
