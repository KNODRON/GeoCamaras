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

let map;
let markersLayer;
let allIncidencias = [];
let currentUser = null;

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
    const filtered = getFilteredIncidencias();
    exportarCSV(filtered);
  });
}

function initMap() {
  map = L.map("mapAdmin", {
    gestureHandling: true,
    scrollWheelZoom: false
  }).setView([-33.45694, -70.64827], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

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

function aplicarColorEstado(select) {
  select.classList.remove("pendiente", "en_proceso", "resuelto");
  select.classList.add(select.value);
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
    if (item.estado === "resuelto") return;
    if (!coordenadasValidas(item)) return;

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
