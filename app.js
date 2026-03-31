// =========================
// DATOS DEMO
// =========================

const sectores = [
  {
    id: "s1",
    nombre: "Plaza Central",
    nivel: "critical",
    indice: 87,
    incidencias: 12,
    pendientes: 4,
    horario: "19:00–23:00",
    inspector: "Pérez",
    categorias: [
      ["Comercio irregular", 4],
      ["Consumo alcohol/drogas", 3],
      ["Ruidos molestos", 2],
      ["Vehículos abandonados", 2],
      ["Daño mobiliario", 1]
    ],
    polygon: [
      [-33.4489, -70.6624],
      [-33.4489, -70.6598],
      [-33.4512, -70.6598],
      [-33.4512, -70.6624]
    ]
  },
  {
    id: "s2",
    nombre: "Feria Norte",
    nivel: "high",
    indice: 69,
    incidencias: 9,
    pendientes: 3,
    horario: "17:00–21:00",
    inspector: "Soto",
    categorias: [
      ["Comercio irregular", 3],
      ["Vehículos abandonados", 2],
      ["Riñas", 2],
      ["Ruidos molestos", 1],
      ["Microbasural", 1]
    ],
    polygon: [
      [-33.4468, -70.6598],
      [-33.4468, -70.6572],
      [-33.4490, -70.6572],
      [-33.4490, -70.6598]
    ]
  },
  {
    id: "s3",
    nombre: "Av. Los Pinos",
    nivel: "medium",
    indice: 48,
    incidencias: 7,
    pendientes: 2,
    horario: "18:00–22:00",
    inspector: "Muñoz",
    categorias: [
      ["Luminaria apagada", 3],
      ["Vehículos abandonados", 2],
      ["Daño mobiliario", 1],
      ["Ruidos molestos", 1]
    ],
    polygon: [
      [-33.4512, -70.6598],
      [-33.4512, -70.6572],
      [-33.4533, -70.6572],
      [-33.4533, -70.6598]
    ]
  },
  {
    id: "s4",
    nombre: "Barrio Sur",
    nivel: "low",
    indice: 18,
    incidencias: 3,
    pendientes: 1,
    horario: "15:00–18:00",
    inspector: "Rojas",
    categorias: [
      ["Microbasural", 1],
      ["Luminaria apagada", 1],
      ["Ruido molesto", 1]
    ],
    polygon: [
      [-33.4512, -70.6624],
      [-33.4512, -70.6598],
      [-33.4533, -70.6598],
      [-33.4533, -70.6624]
    ]
  }
];

const incidencias = [
  {
    id: 184,
    tipo: "Comercio irregular",
    sector: "Plaza Central",
    estado: "Pendiente",
    inspector: "Pérez",
    fecha: "31-03-2026 18:42",
    lat: -33.4501,
    lng: -70.6611
  },
  {
    id: 185,
    tipo: "Vehículo abandonado",
    sector: "Feria Norte",
    estado: "En gestión",
    inspector: "Soto",
    fecha: "31-03-2026 17:11",
    lat: -33.4479,
    lng: -70.6583
  },
  {
    id: 186,
    tipo: "Luminaria apagada",
    sector: "Av. Los Pinos",
    estado: "Resuelto",
    inspector: "Muñoz",
    fecha: "31-03-2026 15:06",
    lat: -33.4523,
    lng: -70.6584
  },
  {
    id: 187,
    tipo: "Ruidos molestos",
    sector: "Plaza Central",
    estado: "Pendiente",
    inspector: "Pérez",
    fecha: "31-03-2026 20:03",
    lat: -33.4498,
    lng: -70.6602
  }
];

// =========================
// REFERENCIAS DOM
// =========================

const detailBadge = document.getElementById("detailBadge");
const detailBody = document.getElementById("detailBody");
const layerButtons = document.querySelectorAll(".layer-btn");

// Validación básica por si el panel derecho no existe en móvil
const hasDetailPanel = !!detailBadge && !!detailBody;

// =========================
// HELPERS
// =========================

function getSectorColor(nivel) {
  switch (nivel) {
    case "critical":
      return "#e53935";
    case "high":
      return "#fb8c00";
    case "medium":
      return "#fdd835";
    case "low":
      return "#66bb6a";
    default:
      return "#90a4ae";
  }
}

function getBadgeClass(nivel) {
  switch (nivel) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return "low";
  }
}

function getBadgeText(nivel) {
  switch (nivel) {
    case "critical":
      return "MUY CRÍTICO";
    case "high":
      return "CRÍTICO";
    case "medium":
      return "ALTO";
    case "low":
      return "BAJO";
    default:
      return "SIN DATO";
  }
}

function escapeHtml(text) {
  if (typeof text !== "string") return text;
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =========================
// PANEL DERECHO
// =========================

function renderSectorDetail(sector) {
  if (!hasDetailPanel) return;

  detailBadge.className = `badge ${getBadgeClass(sector.nivel)}`;
  detailBadge.textContent = getBadgeText(sector.nivel);

  const categoriasHtml = sector.categorias
    .map(([nombre, valor]) => {
      return `
        <div>
          <span>${escapeHtml(nombre)}</span>
          <strong>${escapeHtml(String(valor))}</strong>
        </div>
      `;
    })
    .join("");

  detailBody.innerHTML = `
    <div class="detail-card">
      <h4>${escapeHtml(sector.nombre)}</h4>
      <div class="detail-list">
        <div><span>Índice territorial</span><strong>${escapeHtml(String(sector.indice))}</strong></div>
        <div><span>Incidencias</span><strong>${escapeHtml(String(sector.incidencias))}</strong></div>
        <div><span>Casos pendientes</span><strong>${escapeHtml(String(sector.pendientes))}</strong></div>
        <div><span>Horario crítico</span><strong>${escapeHtml(sector.horario)}</strong></div>
        <div><span>Último inspector</span><strong>${escapeHtml(sector.inspector)}</strong></div>
      </div>
    </div>

    <div class="detail-card">
      <h4>Categorías dominantes</h4>
      <div class="detail-list">
        ${categoriasHtml}
      </div>
    </div>

    <div class="detail-card">
      <h4>Acciones sugeridas</h4>
      <div class="meta">
        - Reforzar presencia en horario crítico<br>
        - Revisar reincidencia del sector<br>
        - Coordinar fiscalización focalizada<br>
        - Levantar evidencia complementaria
      </div>
    </div>
  `;
}

// =========================
// MAPA
// =========================

const map = L.map("map", {
  zoomControl: true
}).setView([-33.4498, -70.6597], 16);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap"
}).addTo(map);

const multicriterioLayer = L.layerGroup();
const marcadoresLayer = L.layerGroup();

// =========================
// DIBUJO DE SECTORES
// =========================

sectores.forEach((sector) => {
  const polygon = L.polygon(sector.polygon, {
    color: "#ffffff",
    weight: 1,
    fillColor: getSectorColor(sector.nivel),
    fillOpacity: 0.5
  });

  polygon.bindPopup(`
    <strong>${escapeHtml(sector.nombre)}</strong><br>
    Índice: ${escapeHtml(String(sector.indice))}<br>
    Incidencias: ${escapeHtml(String(sector.incidencias))}<br>
    Pendientes: ${escapeHtml(String(sector.pendientes))}
  `);

  polygon.on("click", () => {
    renderSectorDetail(sector);
  });

  polygon.addTo(multicriterioLayer);
});

// =========================
// DIBUJO DE INCIDENCIAS
// =========================

incidencias.forEach((inc) => {
  const marker = L.circleMarker([inc.lat, inc.lng], {
    radius: 7,
    color: "#ffffff",
    weight: 2,
    fillColor: "#0b5d52",
    fillOpacity: 1
  });

  marker.bindPopup(`
    <strong>#${escapeHtml(String(inc.id))} - ${escapeHtml(inc.tipo)}</strong><br>
    Sector: ${escapeHtml(inc.sector)}<br>
    Inspector: ${escapeHtml(inc.inspector)}<br>
    Estado: ${escapeHtml(inc.estado)}<br>
    Fecha: ${escapeHtml(inc.fecha)}
  `);

  marker.addTo(marcadoresLayer);
});

// =========================
// AJUSTAR VISTA
// =========================

const allCoords = [];
sectores.forEach((sector) => {
  sector.polygon.forEach((coord) => allCoords.push(coord));
});

if (allCoords.length > 0) {
  map.fitBounds(allCoords, { padding: [20, 20] });
}

// =========================
// CAPAS
// =========================

function setLayerMode(mode) {
  layerButtons.forEach((button) => button.classList.remove("active"));

  const activeButton = document.querySelector(`[data-layer="${mode}"]`);
  if (activeButton) {
    activeButton.classList.add("active");
  }

  if (map.hasLayer(multicriterioLayer)) {
    map.removeLayer(multicriterioLayer);
  }

  if (map.hasLayer(marcadoresLayer)) {
    map.removeLayer(marcadoresLayer);
  }

  if (mode === "multicriterio") {
    multicriterioLayer.addTo(map);
  } else if (mode === "marcadores") {
    marcadoresLayer.addTo(map);
  } else if (mode === "ambos") {
    multicriterioLayer.addTo(map);
    marcadoresLayer.addTo(map);
  }
}

layerButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.layer;
    setLayerMode(mode);
  });
});

// =========================
// INICIALIZACIÓN
// =========================

if (sectores.length > 0) {
  renderSectorDetail(sectores[0]);
}

setLayerMode("multicriterio");
