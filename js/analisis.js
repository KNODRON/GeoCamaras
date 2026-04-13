import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const rankingMeta = document.getElementById("rankingMeta");
const tablaTopSectores = document.getElementById("tablaTopSectores");
const lecturaAutomatica = document.getElementById("lecturaAutomatica");

/* ==========================
   VARIABLES
========================== */
let allIncidencias = [];
let mapAnalisis = null;
let mapLayer = null;

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

        usuarioEl.textContent = "Usuario: " + (profile.nombre || user.email);

        initMap();

        btnActualizar.addEventListener("click", renderAnalisis);

        onSnapshot(collection(db, "incidencias"), (snapshot) => {

            allIncidencias = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
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

    const categorias = [...new Set(allIncidencias.map(i => i.categoria).filter(Boolean))];
    const inspectores = [...new Set(allIncidencias.map(i => i.nombreUsuario).filter(Boolean))];

    categoriaEl.innerHTML =
        '<option value="">Todas</option>' +
        categorias.map(c => `<option value="${c}">${c}</option>`).join("");

    inspectorEl.innerHTML =
        '<option value="">Todos</option>' +
        inspectores.map(i => `<option value="${i}">${i}</option>`).join("");

}

/* ==========================
   FECHA FIREBASE
========================== */
function getFechaDate(fecha) {

    if (!fecha) return null;

    if (typeof fecha.toDate === "function") {
        return fecha.toDate();
    }

    return new Date(fecha);

}

/* ==========================
   FILTRAR INCIDENCIAS
========================== */
function filtrarIncidencias() {

    const dias = Number(periodoEl.value);
    const categoria = categoriaEl.value;
    const estado = estadoEl.value;
    const inspector = inspectorEl.value;

    return allIncidencias.filter(item => {

        const fecha = getFechaDate(item.fecha);

        if (dias > 0) {

            const limite = new Date();
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

        const key =
            item.lat.toFixed(4) + "_" +
            item.lng.toFixed(4);

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

    return Object.values(sectores).map(s => ({

        ...s,

        indice: Math.min(100, Math.round(s.score * 8)),

        categoriaDominante:
            Object.entries(s.categorias)
                .sort((a, b) => b[1] - a[1])[0][0]

    })).sort((a, b) => b.indice - a.indice);

}

/* ==========================
   RENDER GENERAL
========================== */
function renderAnalisis() {

    const registros = filtrarIncidencias();
    const sectores = agruparPorSector(registros);

    kpiTotal.textContent = registros.length;

    kpiPendientes.textContent =
        registros.filter(i => i.estado === "pendiente").length;

    kpiCriticos.textContent =
        sectores.filter(s => s.indice >= 75).length;

    kpiReincidencias.textContent =
        sectores.filter(s => s.total >= 2).length;

    renderTablaSectores(sectores);
    renderMapa(sectores);

}

/* ==========================
   TABLA TOP SECTORES
========================== */
function renderTablaSectores(sectores) {

    rankingMeta.textContent =
        sectores.length + " sectores analizados";

    tablaTopSectores.innerHTML =
        sectores.slice(0, 10).map(s => `
            <tr>
                <td>${s.nombre}</td>
                <td>${s.indice}</td>
                <td>${s.total}</td>
                <td>${s.categoriaDominante}</td>
                <td>${s.score.toFixed(1)}</td>
                <td>${s.indice >= 75 ? "Crítico" : "Normal"}</td>
            </tr>
        `).join("");

    if (sectores[0]) {

        lecturaAutomatica.innerHTML = `
            <b>${sectores[0].nombre}</b> presenta actualmente
            el mayor índice territorial con valor de
            <b>${sectores[0].indice}</b>,
            predominando la categoría
            <b>${sectores[0].categoriaDominante}</b>.
        `;

    }

}

/* ==========================
   MAPA
========================== */
function initMap() {

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

    mapLayer.clearLayers();

    sectores.slice(0, 5).forEach(s => {

        L.circleMarker(
            [s.lat, s.lng],
            {
                radius: 10,
                color: s.indice >= 75 ? "red" : "orange"
            }
        )
        .bindPopup(`
            ${s.nombre}<br>
            Índice: ${s.indice}
        `)
        .addTo(mapLayer);

    });

}
