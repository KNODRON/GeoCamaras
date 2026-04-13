import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const tableBody = document.getElementById("tablaListadoBody");
const reportMeta = document.getElementById("reportMeta");

const filtroBuscar = document.getElementById("buscar");
const filtroPeriodo = document.getElementById("periodo");
const filtroCategoria = document.getElementById("categoria");
const filtroEstado = document.getElementById("estado");
const filtroSector = document.getElementById("sector");
const filtroInspector = document.getElementById("inspector");
const btnAplicarFiltros = document.getElementById("btnAplicarFiltros");
const btnExportarCSV = document.getElementById("btnExportarCSV");

let todasLasIncidencias = [];

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFechaDate(fecha) {
  if (!fecha) return null;

  try {
    if (typeof fecha.toDate === "function") return fecha.toDate();
    const d = new Date(fecha);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function formatFecha(fecha) {
  const d = getFechaDate(fecha);
  return d ? d.toLocaleString("es-CL") : "Sin fecha";
}

function capitalizeEstado(estado) {
  const limpio = String(estado || "").trim().toLowerCase();

  switch (limpio) {
    case "pendiente":
      return "Pendiente";
    case "en_proceso":
    case "en proceso":
    case "en gestión":
    case "en gestion":
      return "En proceso";
    case "resuelto":
      return "Resuelto";
    default:
      return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : "Sin estado";
  }
}

function getEstadoClass(estado) {
  if (estado === "pendiente") return "estado-pendiente";
  if (estado === "en_proceso") return "estado-en-proceso";
  if (estado === "resuelto") return "estado-resuelto";
  return "";
}

function aplicarColorEstado(select) {
  select.classList.remove("estado-pendiente", "estado-en-proceso", "estado-resuelto");
  select.classList.add(getEstadoClass(select.value));
}

function getPeriodoDias(value) {
  switch (value) {
    case "Últimos 7 días":
      return 7;
    case "Últimos 30 días":
      return 30;
    case "Este mes":
      return 31;
    default:
      return null;
  }
}

function getSectorNombre(item) {
  if (
    typeof item?.lat === "number" &&
    typeof item?.lng === "number" &&
    !Number.isNaN(item.lat) &&
    !Number.isNaN(item.lng)
  ) {
    return `Cuadrícula ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`;
  }

  return item.direccion || "Sin dirección";
}

function llenarFiltrosDinamicos(incidencias) {
  const categorias = [...new Set(incidencias.map((i) => i.categoria).filter(Boolean))].sort();
  const sectores = [...new Set(incidencias.map((i) => getSectorNombre(i)).filter(Boolean))].sort();
  const inspectores = [...new Set(incidencias.map((i) => i.nombreUsuario || "N/A"))].sort();

  filtroCategoria.innerHTML =
    `<option value="">Todas</option>` +
    categorias.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  filtroSector.innerHTML =
    `<option value="">Todos</option>` +
    sectores.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");

  filtroInspector.innerHTML =
    `<option value="">Todos</option>` +
    inspectores.map((i) => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join("");
}

function aplicarFiltros(incidencias) {
  const buscar = (filtroBuscar.value || "").trim().toLowerCase();
  const categoria = filtroCategoria.value || "";
  const estado = filtroEstado.value || "";
  const sector = filtroSector.value || "";
  const inspector = filtroInspector.value || "";
  const dias = getPeriodoDias(filtroPeriodo.value || "");

  return incidencias.filter((item) => {
    const fecha = getFechaDate(item.fecha);

    if (dias && fecha) {
      const limite = new Date();
      limite.setDate(limite.getDate() - dias);
      if (fecha < limite) return false;
    }

    if (categoria && item.categoria !== categoria) return false;
    if (estado && String(item.estado || "").toLowerCase() !== estado.toLowerCase()) return false;
    if (sector && getSectorNombre(item) !== sector) return false;
    if (inspector && (item.nombreUsuario || "N/A") !== inspector) return false;

    if (buscar) {
      const texto = [
        item.id,
        item.categoria,
        item.descripcion,
        item.direccion,
        item.nombreUsuario,
        getSectorNombre(item)
      ].join(" ").toLowerCase();

      if (!texto.includes(buscar)) return false;
    }

    return true;
  });
}

function renderTabla(registros) {
  if (!registros.length) {
    tableBody.innerHTML = `<tr><td colspan="9">No hay incidencias para los filtros seleccionados.</td></tr>`;
    reportMeta.textContent = "0 incidencias visibles";
    return;
  }

  tableBody.innerHTML = registros.map((item) => {
    const estadoRaw = String(item.estado || "").toLowerCase();

    return `
      <tr>
        <td>#${escapeHtml(item.id.slice(0, 6))}</td>
        <td>${escapeHtml(item.categoria || "Sin categoría")}</td>
        <td>${escapeHtml(item.descripcion || "-")}</td>
        <td>${escapeHtml(getSectorNombre(item))}</td>
        <td>${escapeHtml(item.nombreUsuario || "N/A")}</td>
        <td>
          <select class="estado-select ${getEstadoClass(estadoRaw)}" data-id="${item.id}">
            <option value="pendiente" ${estadoRaw === "pendiente" ? "selected" : ""}>Pendiente</option>
            <option value="en_proceso" ${estadoRaw === "en_proceso" ? "selected" : ""}>En proceso</option>
            <option value="resuelto" ${estadoRaw === "resuelto" ? "selected" : ""}>Resuelto</option>
          </select>
        </td>
        <td>${escapeHtml(formatFecha(item.fecha))}</td>
        <td>${typeof item.lat === "number" ? item.lat.toFixed(6) : "-"}</td>
        <td>${typeof item.lng === "number" ? item.lng.toFixed(6) : "-"}</td>
      </tr>
    `;
  }).join("");

  reportMeta.textContent = `${registros.length} incidencias visibles`;

  document.querySelectorAll(".estado-select").forEach((select) => {
    aplicarColorEstado(select);

    select.addEventListener("change", async (e) => {
      const nuevoEstado = e.target.value;
      const id = e.target.dataset.id;

      aplicarColorEstado(e.target);

      try {
        await updateDoc(doc(db, "incidencias", id), {
          estado: nuevoEstado
        });
      } catch (error) {
        console.error("Error actualizando estado:", error);
      }
    });
  });
}

function exportarCSV(registros) {
  const fechaGeneracion = new Date().toLocaleString("es-CL");
  const total = registros.length;

  const filasHtml = registros.map((item) => {
    const estado = capitalizeEstado(item.estado);
    let estadoBg = "#fff4e1";
    let estadoColor = "#b97717";

    if (String(item.estado || "").toLowerCase() === "pendiente") {
      estadoBg = "#fdeaea";
      estadoColor = "#b94d4d";
    } else if (String(item.estado || "").toLowerCase() === "resuelto") {
      estadoBg = "#e7f6ea";
      estadoColor = "#2f8534";
    }

    return `
      <tr>
        <td style="border:1px solid #d7dde3; padding:8px;">#${item.id.slice(0, 6)}</td>
        <td style="border:1px solid #d7dde3; padding:8px;">${escapeHtml(item.categoria || "")}</td>
        <td style="border:1px solid #d7dde3; padding:8px;">${escapeHtml(item.descripcion || "")}</td>
        <td style="border:1px solid #d7dde3; padding:8px;">${escapeHtml(getSectorNombre(item))}</td>
        <td style="border:1px solid #d7dde3; padding:8px;">${escapeHtml(item.nombreUsuario || "N/A")}</td>
        <td style="border:1px solid #d7dde3; padding:8px; background:${estadoBg}; color:${estadoColor}; font-weight:bold;">
          ${escapeHtml(estado)}
        </td>
        <td style="border:1px solid #d7dde3; padding:8px;">${escapeHtml(formatFecha(item.fecha))}</td>
        <td style="border:1px solid #d7dde3; padding:8px;">${typeof item.lat === "number" ? item.lat : ""}</td>
        <td style="border:1px solid #d7dde3; padding:8px;">${typeof item.lng === "number" ? item.lng : ""}</td>
      </tr>
    `;
  }).join("");

  const htmlExcel = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <meta name="ProgId" content="Excel.Sheet">
      <meta name="Generator" content="GeoRegistro">
      <style>
        body {
          font-family: Calibri, Arial, sans-serif;
        }

        .title {
          background: #0b7c70;
          color: white;
          font-size: 18pt;
          font-weight: bold;
          text-align: left;
          padding: 14px;
        }

        .subtitle {
          background: #0f9a8a;
          color: white;
          font-size: 10pt;
          padding: 8px 14px;
        }

        .meta-label {
          background: #f3f6f8;
          font-weight: bold;
          border: 1px solid #d7dde3;
          padding: 8px;
        }

        .meta-value {
          border: 1px solid #d7dde3;
          padding: 8px;
        }

        .header {
          background: #dff3ef;
          color: #0b5d52;
          font-weight: bold;
          text-transform: uppercase;
          border: 1px solid #c8d5dc;
          padding: 9px;
        }

        table {
          border-collapse: collapse;
        }
      </style>
    </head>
    <body>
      <table>
        <tr>
          <td class="title" colspan="9">GeoRegistro - Reporte de Incidencias</td>
        </tr>
        <tr>
          <td class="subtitle" colspan="9">Plataforma de análisis territorial y apoyo a la decisión en seguridad municipal</td>
        </tr>
      </table>

      <br>

      <table>
        <tr>
          <td class="meta-label">Sistema</td>
          <td class="meta-value">GeoRegistro</td>
        </tr>
        <tr>
          <td class="meta-label">Reporte</td>
          <td class="meta-value">Listado de incidencias</td>
        </tr>
        <tr>
          <td class="meta-label">Fecha de generación</td>
          <td class="meta-value">${escapeHtml(fechaGeneracion)}</td>
        </tr>
        <tr>
          <td class="meta-label">Total de registros</td>
          <td class="meta-value">${total}</td>
        </tr>
      </table>

      <br>

      <table>
        <colgroup>
          <col style="width:110px;">
          <col style="width:150px;">
          <col style="width:340px;">
          <col style="width:260px;">
          <col style="width:170px;">
          <col style="width:120px;">
          <col style="width:220px;">
          <col style="width:120px;">
          <col style="width:120px;">
        </colgroup>

        <tr>
          <td class="header">Folio</td>
          <td class="header">Categoría</td>
          <td class="header">Descripción</td>
          <td class="header">Dirección / Sector</td>
          <td class="header">Inspector</td>
          <td class="header">Estado</td>
          <td class="header">Fecha</td>
          <td class="header">Latitud</td>
          <td class="header">Longitud</td>
        </tr>

        ${filasHtml}
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(
    ["\ufeff", htmlExcel],
    { type: "application/vnd.ms-excel;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fechaArchivo = new Date().toISOString().slice(0, 10);

  a.href = url;
  a.download = `georegistro_reporte_${fechaArchivo}.xls`;
  a.click();

  URL.revokeObjectURL(url);
}

function refrescarVista() {
  const filtradas = aplicarFiltros(todasLasIncidencias);
  renderTabla(filtradas);

  btnExportarCSV.onclick = () => exportarCSV(filtradas);
}

function cargarIncidenciasRealtime() {
  onSnapshot(
    collection(db, "incidencias"),
    (snapshot) => {
      todasLasIncidencias = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      llenarFiltrosDinamicos(todasLasIncidencias);
      refrescarVista();
    },
    (error) => {
      console.error("Error leyendo incidencias:", error);
      tableBody.innerHTML = `<tr><td colspan="9">Error leyendo incidencias.</td></tr>`;
    }
  );
}

function iniciarListado() {
  btnAplicarFiltros.addEventListener("click", refrescarVista);
  cargarIncidenciasRealtime();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  try {
    const ref = doc(db, "usuarios", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      window.location.href = "./login.html";
      return;
    }

    const profile = snap.data();

    if (!profile.activo || profile.rol !== "admin") {
      window.location.href = "./login.html";
      return;
    }

    iniciarListado();
  } catch (error) {
    console.error("Error validando acceso al listado:", error);
    window.location.href = "./login.html";
  }
});
