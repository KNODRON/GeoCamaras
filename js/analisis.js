import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  onSnapshot,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ==========================
   ELEMENTOS UI
========================== */
const usuarioEl = document.getElementById("analisisUsuario");
const periodoEl = document.getElementById("analisisPeriodo");
const categoriaEl = document.getElementById("analisisCategoria");
const estadoEl = document.getElementById("analisisEstado");
const inspectorEl = document.getElementById("analisisInspector");
const btnActualizar = document.getElementById("btnActualizarAnalisis");

const kpiTotal = document.getElementById("kpiTotal");
const kpiPendientes = document.getElementById("kpiPendientes");
const kpiCriticos = document.getElementById("kpiCriticos");
const kpiReincidencias = document.getElementById("kpiReincidencias");
const kpiTendencia = document.getElementById("kpiTendencia");
const kpiTendenciaDetalle = document.getElementById("kpiTendenciaDetalle");
const kpiCategoria = document.getElementById("kpiCategoria");

const rankingMeta = document.getElementById("rankingMeta");
const tablaTopSectores = document.getElementById("tablaTopSectores");
const lecturaAutomatica = document.getElementById("lecturaAutomatica");

const varGeneral = document.getElementById("varGeneral");
const varSeguridad = document.getElementById("varSeguridad");
const proyeccionPeriodo = document.getElementById("proyeccionPeriodo");

const contenedorAlertas = document.getElementById("contenedorAlertas");
const franjaCritica = document.getElementById("franjaCritica");
const franjaCriticaDetalle = document.getElementById("franjaCriticaDetalle");
const lecturaHoraria = document.getElementById("lecturaHoraria");
/* ==========================
   VARIABLES
========================== */
let allIncidencias = [];
let mapAnalisis = null;
let mapLayer = null;

let chartCategorias = null;
let chartEstados = null;
let chartTendencia = null;

let chartHorarios = null;
let chartComparativaCategorias = null;

/* ==========================
   PESOS SAIT / MULTICRITERIO
========================== */
const PESOS = {
  "Seguridad": 3,
  "Alumbrado": 2,
  "Infraestructura": 2,
  "Basura": 1,
  "Áreas Verdes": 1,
  "Zoonosis": 1
};

const ESTADO_FACTOR = {
  "pendiente": 1.5,
  "en_proceso": 1,
  "resuelto": 0.3
};

/* ==========================
   LOGIN / VALIDACIÓN
========================== */
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

    if (usuarioEl) {
      usuarioEl.textContent = "Usuario: " + (profile.nombre || user.email);
    }

    initMap();

    if (btnActualizar) {
      btnActualizar.addEventListener("click", renderAnalisis);
    }

    onSnapshot(collection(db, "incidencias"), (snapshot) => {
      allIncidencias = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      llenarFiltros();
      renderAnalisis();
    });

  } catch (error) {
    console.error(error);
    window.location.href = "./login.html";
  }
});

/* ==========================
   LLENAR FILTROS
========================== */
function llenarFiltros() {
  if (!categoriaEl || !inspectorEl) return;

  const categorias = [...new Set(allIncidencias.map(i => i.categoria).filter(Boolean))];
  const inspectores = [...new Set(allIncidencias.map(i => i.nombreUsuario).filter(Boolean))];

  categoriaEl.innerHTML =
    '<option value="">Todas</option>' +
    categorias.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  inspectorEl.innerHTML =
    '<option value="">Todos</option>' +
    inspectores.map(i => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join("");
}

/* ==========================
   FECHA FIREBASE
========================== */
function getFechaDate(fecha) {
  if (!fecha) return null;

  if (typeof fecha.toDate === "function") {
    return fecha.toDate();
  }

  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ==========================
   HELPERS
========================== */
function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDiasFiltro() {
  const dias = Number(periodoEl?.value || 7);
  return Number.isNaN(dias) ? 7 : dias;
}

/* ==========================
   FILTRAR INCIDENCIAS
========================== */
function filtrarIncidencias() {
  const dias = getDiasFiltro();
  const categoria = categoriaEl?.value || "";
  const estado = estadoEl?.value || "";
  const inspector = inspectorEl?.value || "";

  return allIncidencias.filter(item => {
    const fecha = getFechaDate(item.fecha);

    if (dias > 0 && fecha) {
      const limite = new Date();
      limite.setHours(0, 0, 0, 0);
      limite.setDate(limite.getDate() - dias);

      if (fecha < limite) return false;
    }

    if (categoria && item.categoria !== categoria) return false;
    if (estado && item.estado !== estado) return false;
    if (inspector && item.nombreUsuario !== inspector) return false;

    return true;
  });
}

/* ==========================
   AGRUPAR POR SECTOR
========================== */
function agruparPorSector(registros) {
  const sectores = {};

  registros.forEach(item => {
    if (typeof item.lat !== "number" || typeof item.lng !== "number") return;

    const key = item.lat.toFixed(4) + "_" + item.lng.toFixed(4);

    if (!sectores[key]) {
      sectores[key] = {
        nombre: `Cuadrícula ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`,
        total: 0,
        score: 0,
        categorias: {},
        lat: item.lat,
        lng: item.lng
      };
    }

    sectores[key].total++;

    sectores[key].categorias[item.categoria] =
      (sectores[key].categorias[item.categoria] || 0) + 1;

    sectores[key].score +=
      (PESOS[item.categoria] || 1) *
      (ESTADO_FACTOR[item.estado] || 1);
  });

  return Object.values(sectores)
    .map(s => ({
      ...s,
      indice: Math.min(100, Math.round(s.score * 8)),
      categoriaDominante:
        Object.entries(s.categorias).sort((a, b) => b[1] - a[1])[0]?.[0] || "Sin categoría"
    }))
    .sort((a, b) => b.indice - a.indice);
}

/* ==========================
   RENDER GENERAL
========================== */
function renderAnalisis() {
  const registros = filtrarIncidencias();
  const sectores = agruparPorSector(registros);

  if (kpiTotal) {
    kpiTotal.textContent = registros.length;
  }

  if (kpiPendientes) {
    kpiPendientes.textContent =
      registros.filter(i => i.estado === "pendiente").length;
  }

  if (kpiCriticos) {
    kpiCriticos.textContent =
      sectores.filter(s => s.indice >= 75).length;
  }

  if (kpiReincidencias) {
    kpiReincidencias.textContent =
      sectores.filter(s => s.total >= 2).length;
  }

  if (kpiCategoria) {
    const categoriaDominanteGlobal =
      Object.entries(contarPorCategoria(registros))
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    kpiCategoria.textContent = categoriaDominanteGlobal;
  }

  if (kpiTendencia && kpiTendenciaDetalle) {
    const tendencia = calcularTendenciaGeneral(registros);
    kpiTendencia.textContent = tendencia.texto;
    kpiTendencia.classList.remove("positivo", "negativo", "neutro");
    kpiTendencia.classList.add(tendencia.clase);
    kpiTendenciaDetalle.textContent = tendencia.detalle;
  }

  renderChartCategorias(registros);
  renderChartEstados(registros);
  renderChartTendencia(registros);
  renderChartHorarios(registros);
  renderChartComparativaCategorias(registros);

  renderTablaSectores(sectores);
  renderMapa(sectores);
  calcularComparativa(registros);
  renderAlertas(registros, sectores);
}

/* ==========================
   CONTAR POR CATEGORÍA
========================== */
function contarPorCategoria(registros) {
  const conteo = {};

  registros.forEach(item => {
    const categoria = item.categoria || "Sin categoría";
    conteo[categoria] = (conteo[categoria] || 0) + 1;
  });

  return conteo;
}

/* ==========================
   TENDENCIA GENERAL KPI
========================== */
function calcularTendenciaGeneral(registrosActuales) {
  const dias = getDiasFiltro();

  if (dias <= 0) {
    return {
      texto: "—",
      detalle: "Sin comparación aún",
      clase: "neutro"
    };
  }

  const hoy = new Date();

  const inicioActual = new Date();
  inicioActual.setDate(hoy.getDate() - dias);

  const inicioAnterior = new Date();
  inicioAnterior.setDate(hoy.getDate() - (dias * 2));

  const finAnterior = new Date(inicioActual);

  const periodoAnterior = allIncidencias.filter(i => {
    const fecha = getFechaDate(i.fecha);
    return fecha && fecha >= inicioAnterior && fecha < finAnterior;
  });

  const totalAnterior = periodoAnterior.length;
  const totalActual = registrosActuales.length;

  if (totalAnterior === 0 && totalActual === 0) {
    return {
      texto: "Estable",
      detalle: "Sin variación detectable",
      clase: "neutro"
    };
  }

  if (totalAnterior === 0 && totalActual > 0) {
    return {
      texto: "Al alza",
      detalle: "No existe base anterior comparable",
      clase: "negativo"
    };
  }

  const variacion = ((totalActual - totalAnterior) / totalAnterior) * 100;

  if (variacion > 5) {
    return {
      texto: "Al alza",
      detalle: `${variacion.toFixed(1)}% respecto al período anterior`,
      clase: "negativo"
    };
  }

  if (variacion < -5) {
    return {
      texto: "A la baja",
      detalle: `${Math.abs(variacion).toFixed(1)}% respecto al período anterior`,
      clase: "positivo"
    };
  }

  return {
    texto: "Estable",
    detalle: "Variación menor al 5%",
    clase: "neutro"
  };
}

/* ==========================
   TABLA TOP SECTORES
========================== */
function renderTablaSectores(sectores) {
  if (rankingMeta) {
    rankingMeta.textContent = sectores.length + " sectores analizados";
  }

  if (!tablaTopSectores) return;

  if (!sectores.length) {
    tablaTopSectores.innerHTML = `
      <tr>
        <td colspan="6">No hay datos suficientes para el análisis.</td>
      </tr>
    `;
    if (lecturaAutomatica) {
      lecturaAutomatica.textContent = "No hay información suficiente para generar lectura automática.";
    }
    return;
  }

  tablaTopSectores.innerHTML = sectores.slice(0, 10).map(s => `
    <tr>
      <td>${s.nombre}</td>
      <td>${s.indice}</td>
      <td>${getPrioridadTexto(s.indice)}</td>
      <td>${s.total >= 2 ? "Sí" : "No"}</td>
      <td>${s.categoriaDominante}</td>
      <td>${getTendenciaTexto(s.total)}</td>
    </tr>
  `).join("");

  if (lecturaAutomatica && sectores[0]) {
    lecturaAutomatica.innerHTML = `
      <b>${sectores[0].nombre}</b> presenta actualmente
      el mayor índice territorial con valor de
      <b>${sectores[0].indice}</b>,
      predominando la categoría
      <b>${sectores[0].categoriaDominante}</b>.
    `;
  }
}

function getPrioridadTexto(indice) {
  if (indice >= 75) return "Crítico";
  if (indice >= 50) return "Alto";
  if (indice >= 25) return "Medio";
  return "Normal";
}

function getTendenciaTexto(total) {
  if (total >= 4) return "Al alza";
  if (total >= 2) return "Normal";
  return "Baja";
}

/* ==========================
   MAPA
========================== */
function initMap() {
  const mapEl = document.getElementById("mapAnalisis");
  if (!mapEl) return;

  mapAnalisis = L.map("mapAnalisis").setView(
    [-33.45, -70.65],
    12
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "&copy; OpenStreetMap"
    }
  ).addTo(mapAnalisis);

  mapLayer = L.layerGroup().addTo(mapAnalisis);
}

/* ==========================
   RENDER MAPA
========================== */
function renderMapa(sectores) {
  if (!mapLayer) return;

  mapLayer.clearLayers();

  sectores.slice(0, 5).forEach(s => {
    L.circleMarker(
      [s.lat, s.lng],
      {
        radius: 10,
        color: s.indice >= 75 ? "red" : s.indice >= 50 ? "orange" : "#0b7c70",
        fillColor: s.indice >= 75 ? "red" : s.indice >= 50 ? "orange" : "#18a38d",
        fillOpacity: 0.8,
        weight: 2
      }
    )
      .bindPopup(`
        <b>${s.nombre}</b><br>
        Índice: ${s.indice}<br>
        Categoría dominante: ${s.categoriaDominante}
      `)
      .addTo(mapLayer);
  });
}

/* ==========================
   COMPARATIVA TEMPORAL
========================== */
function calcularComparativa(registrosActuales) {
  if (!varGeneral || !varSeguridad || !proyeccionPeriodo) return;

  const dias = getDiasFiltro();

  if (dias <= 0) {
    varGeneral.textContent = "--";
    varSeguridad.textContent = "--";
    proyeccionPeriodo.textContent = "--";
    return;
  }

  const hoy = new Date();

  const inicioActual = new Date();
  inicioActual.setDate(hoy.getDate() - dias);

  const inicioAnterior = new Date();
  inicioAnterior.setDate(hoy.getDate() - (dias * 2));

  const finAnterior = new Date(inicioActual);

  const periodoAnterior = allIncidencias.filter(i => {
    const fecha = getFechaDate(i.fecha);
    return fecha && fecha >= inicioAnterior && fecha < finAnterior;
  });

  const totalAnterior = periodoAnterior.length;
  const totalActual = registrosActuales.length;

  let variacion = 0;

  if (totalAnterior > 0) {
    variacion = ((totalActual - totalAnterior) / totalAnterior) * 100;
  }

  varGeneral.textContent = `${variacion >= 0 ? "+" : ""}${variacion.toFixed(1)}%`;
  varGeneral.className = "";
  varGeneral.classList.add(
    variacion > 0 ? "negativo" :
    variacion < 0 ? "positivo" :
    "neutro"
  );

  const segActual =
    registrosActuales.filter(i => i.categoria === "Seguridad").length;

  const segAnterior =
    periodoAnterior.filter(i => i.categoria === "Seguridad").length;

  let varSeg = 0;

  if (segAnterior > 0) {
    varSeg = ((segActual - segAnterior) / segAnterior) * 100;
  } else if (segActual > 0) {
    varSeg = 100;
  }

  varSeguridad.textContent = `${varSeg >= 0 ? "+" : ""}${varSeg.toFixed(1)}%`;
  varSeguridad.className = "";
  varSeguridad.classList.add(
    varSeg > 0 ? "negativo" :
    varSeg < 0 ? "positivo" :
    "neutro"
  );

  let proyeccion = totalActual;

  if (totalAnterior > 0) {
    proyeccion = Math.max(
      0,
      Math.round(totalActual + ((variacion / 100) * totalActual))
    );
  }

  proyeccionPeriodo.textContent = proyeccion;
}

/* ==========================
   GRÁFICO CATEGORÍAS
========================== */
function renderChartCategorias(registros) {
  const canvas = document.getElementById("chartCategorias");
  if (!canvas || typeof Chart === "undefined") return;

  const conteo = contarPorCategoria(registros);

  const labels = Object.keys(conteo);
  const data = Object.values(conteo);

  if (chartCategorias) {
    chartCategorias.destroy();
  }

  chartCategorias = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Incidencias",
        data,
        backgroundColor: [
          "#0b7c70",
          "#18a38d",
          "#43a047",
          "#f2a33a",
          "#d65c5c",
          "#64748b"
        ],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}

/* ==========================
   GRÁFICO ESTADOS
========================== */
function renderChartEstados(registros) {
  const canvas = document.getElementById("chartEstados");
  if (!canvas || typeof Chart === "undefined") return;

  const conteo = {
    Pendiente: 0,
    "En proceso": 0,
    Resuelto: 0
  };

  registros.forEach(item => {
    const estado = String(item.estado || "").toLowerCase();

    if (estado === "pendiente") conteo["Pendiente"]++;
    else if (estado === "en_proceso") conteo["En proceso"]++;
    else if (estado === "resuelto") conteo["Resuelto"]++;
  });

  if (chartEstados) {
    chartEstados.destroy();
  }

  chartEstados = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: Object.keys(conteo),
      datasets: [{
        data: Object.values(conteo),
        backgroundColor: ["#d65c5c", "#f2a33a", "#43a047"],
        borderColor: "#ffffff",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

/* ==========================
   GRÁFICO TENDENCIA
========================== */
function renderChartTendencia(registros) {
  const canvas = document.getElementById("chartTendencia");
  if (!canvas || typeof Chart === "undefined") return;

  const dias = getDiasFiltro() || 7;
  const hoy = new Date();
  const mapaDias = {};

  for (let i = dias - 1; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() - i);
    const key = fecha.toISOString().slice(0, 10);
    mapaDias[key] = 0;
  }

  registros.forEach(item => {
    const fecha = getFechaDate(item.fecha);
    if (!fecha) return;

    const key = fecha.toISOString().slice(0, 10);
    if (mapaDias[key] !== undefined) {
      mapaDias[key]++;
    }
  });

  const labels = Object.keys(mapaDias).map(fecha => {
    const partes = fecha.split("-");
    return `${partes[2]}-${partes[1]}`;
  });

  const data = Object.values(mapaDias);

  if (chartTendencia) {
    chartTendencia.destroy();
  }

  chartTendencia = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Incidencias",
        data,
        borderColor: "#0b7c70",
        backgroundColor: "rgba(24, 163, 141, 0.18)",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}

function renderAlertas(registros, sectores) {
  if (!contenedorAlertas) return;

  const alertas = [];

  const pendientes = registros.filter(i => i.estado === "pendiente");
  const enProceso = registros.filter(i => i.estado === "en_proceso");

  if (pendientes.length >= 5) {
    alertas.push({
      tipo: "critica",
      titulo: "Pendientes acumulados",
      texto: `Se detectan ${pendientes.length} incidencias pendientes dentro del período analizado, lo que sugiere necesidad de seguimiento prioritario.`
    });
  }

  const focoCritico = sectores.find(s => s.indice >= 50);
  if (focoCritico) {
    alertas.push({
      tipo: "critica",
      titulo: "Foco territorial prioritario",
      texto: `${focoCritico.nombre} alcanza un índice territorial de ${focoCritico.indice}, con predominio de ${focoCritico.categoriaDominante}.`
    });
  }

  const reincidente = sectores.find(s => s.total >= 3);
  if (reincidente) {
    alertas.push({
      tipo: "media",
      titulo: "Reincidencia detectada",
      texto: `${reincidente.nombre} concentra ${reincidente.total} eventos en el período, lo que evidencia repetición territorial.`
    });
  }

  const seguridad = registros.filter(i => i.categoria === "Seguridad").length;
  if (seguridad >= 4) {
    alertas.push({
      tipo: "media",
      titulo: "Aumento de eventos de seguridad",
      texto: `La categoría Seguridad registra ${seguridad} incidencias en el período actual, por sobre el comportamiento esperado.`
    });
  }

  if (enProceso.length >= 4) {
    alertas.push({
      tipo: "info",
      titulo: "Casos en gestión",
      texto: `Actualmente existen ${enProceso.length} incidencias en proceso, lo que indica carga operativa activa sobre el territorio.`
    });
  }

  if (!alertas.length) {
    alertas.push({
      tipo: "info",
      titulo: "Sin alertas críticas",
      texto: "No se detectan focos anómalos relevantes para el período seleccionado. El comportamiento territorial se mantiene dentro de rangos normales."
    });
  }

  contenedorAlertas.innerHTML = alertas.slice(0, 6).map(alerta => `
    <article class="alerta-item alerta-${alerta.tipo}">
      <strong>${alerta.titulo}</strong>
      <p>${alerta.texto}</p>
    </article>
  `).join("");
}

function renderChartHorarios(registros) {
  const canvas = document.getElementById("chartHorarios");
  if (!canvas || typeof Chart === "undefined") return;

  const franjas = {
    "00:00 - 06:00": 0,
    "06:00 - 12:00": 0,
    "12:00 - 18:00": 0,
    "18:00 - 00:00": 0
  };

  registros.forEach(item => {
    const fecha = getFechaDate(item.fecha);
    if (!fecha) return;

    const hora = fecha.getHours();

    if (hora >= 0 && hora < 6) {
      franjas["00:00 - 06:00"]++;
    } else if (hora >= 6 && hora < 12) {
      franjas["06:00 - 12:00"]++;
    } else if (hora >= 12 && hora < 18) {
      franjas["12:00 - 18:00"]++;
    } else {
      franjas["18:00 - 00:00"]++;
    }
  });

  const labels = Object.keys(franjas);
  const data = Object.values(franjas);

  if (chartHorarios) {
    chartHorarios.destroy();
  }

  chartHorarios = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Incidencias",
        data,
        backgroundColor: [
          "#64748b",
          "#18a38d",
          "#f2a33a",
          "#d65c5c"
        ],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });

  const top = Object.entries(franjas).sort((a, b) => b[1] - a[1])[0];

  if (!top) return;

  const [franja, total] = top;

  if (franjaCritica) {
    franjaCritica.textContent = franja;
  }

  if (franjaCriticaDetalle) {
    franjaCriticaDetalle.textContent = `${total} incidencias concentradas en esta franja`;
  }

  if (lecturaHoraria) {
    lecturaHoraria.innerHTML = `
      <strong>Lectura operativa:</strong> la mayor concentración territorial se registra en la franja
      <strong>${franja}</strong>, con <strong>${total}</strong> incidencias dentro del período filtrado.
      Esto sugiere reforzar monitoreo, patrullaje preventivo o supervisión focalizada en ese tramo horario.
    `;
  }
}

function renderChartComparativaCategorias(registrosActuales) {
  const canvas = document.getElementById("chartComparativaCategorias");
  if (!canvas || typeof Chart === "undefined") return;

  const dias = getDiasFiltro();
  if (dias <= 0) return;

  const hoy = new Date();

  const inicioActual = new Date();
  inicioActual.setDate(hoy.getDate() - dias);

  const inicioAnterior = new Date();
  inicioAnterior.setDate(hoy.getDate() - (dias * 2));

  const finAnterior = new Date(inicioActual);

  const periodoAnterior = allIncidencias.filter(i => {
    const fecha = getFechaDate(i.fecha);
    return fecha && fecha >= inicioAnterior && fecha < finAnterior;
  });

  const actual = contarPorCategoria(registrosActuales);
  const anterior = contarPorCategoria(periodoAnterior);

  const categorias = [...new Set([
    ...Object.keys(actual),
    ...Object.keys(anterior)
  ])];

  const actualData = categorias.map(cat => actual[cat] || 0);
  const anteriorData = categorias.map(cat => anterior[cat] || 0);

  if (chartComparativaCategorias) {
    chartComparativaCategorias.destroy();
  }

  chartComparativaCategorias = new Chart(canvas, {
    type: "bar",
    data: {
      labels: categorias,
      datasets: [
        {
          label: "Período actual",
          data: actualData,
          backgroundColor: "#0b7c70",
          borderRadius: 8
        },
        {
          label: "Período anterior",
          data: anteriorData,
          backgroundColor: "#cbd5e1",
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}
