// ================================
// GEOREGISTRO - BASE UI FUNCIONAL
// ================================

// --------- ELEMENTOS ---------
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");

const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");

const operadorPanel = document.getElementById("operador-panel");
const adminPanel = document.getElementById("admin-panel");

const roleBadge = document.getElementById("roleBadge");
const userName = document.getElementById("userName");

const categoryButtons = document.querySelectorAll(".card-btn");
const categoriaSeleccionada = document.getElementById("categoriaSeleccionada");
const incidenciaForm = document.getElementById("incidenciaForm");
const btnUbicacion = document.getElementById("btnUbicacion");
const latitudInput = document.getElementById("latitud");
const longitudInput = document.getElementById("longitud");

const filtroCategoria = document.getElementById("filtroCategoria");
const filtroEstado = document.getElementById("filtroEstado");
const filtroTexto = document.getElementById("filtroTexto");
const btnFiltrar = document.getElementById("btnFiltrar");
const btnLimpiarFiltros = document.getElementById("btnLimpiarFiltros");
const btnExportarCSV = document.getElementById("btnExportarCSV");
const adminTableBody = document.getElementById("adminTableBody");

const statTotal = document.getElementById("statTotal");
const statHoy = document.getElementById("statHoy");
const statPendientes = document.getElementById("statPendientes");
const statResueltas = document.getElementById("statResueltas");

// --------- MAPAS ---------
let operadorMap;
let adminMap;
let operadorMarker = null;
let adminMarkers = [];

// --------- SESIÓN SIMULADA ---------
// Cambia esto por Firebase Auth + Firestore después
let currentUser = null;

// --------- DATA SIMULADA ---------
let incidencias = [
  {
    id: "1",
    categoria: "Alumbrado",
    descripcion: "Luminaria apagada frente a plaza",
    direccion: "Av. Central 123",
    lat: -33.4942,
    lng: -70.7081,
    estado: "pendiente",
    fecha: new Date(),
    nombreUsuario: "Operador 1"
  },
  {
    id: "2",
    categoria: "Basura",
    descripcion: "Microbasural en esquina",
    direccion: "Pasaje Los Robles 455",
    lat: -33.4971,
    lng: -70.7045,
    estado: "en_proceso",
    fecha: new Date(Date.now() - 86400000),
    nombreUsuario: "Operador 2"
  },
  {
    id: "3",
    categoria: "Seguridad",
    descripcion: "Poste dañado con riesgo",
    direccion: "Calle Sur 889",
    lat: -33.492,
    lng: -70.7015,
    estado: "resuelto",
    fecha: new Date(),
    nombreUsuario: "Operador 1"
  }
];

// --------- INICIO ---------
document.addEventListener("DOMContentLoaded", () => {
  initMaps();
  initCategoryButtons();
  initEvents();
});

// --------- EVENTOS ---------
function initEvents() {
  loginForm.addEventListener("submit", handleLogin);
  logoutBtn.addEventListener("click", handleLogout);
  btnUbicacion.addEventListener("click", obtenerUbicacion);
  incidenciaForm.addEventListener("submit", registrarIncidencia);

  btnFiltrar.addEventListener("click", aplicarFiltrosAdmin);
  btnLimpiarFiltros.addEventListener("click", limpiarFiltrosAdmin);
  btnExportarCSV.addEventListener("click", () => exportarCSV(incidencias));
}

// --------- LOGIN SIMULADO ---------
// admin@geo.cl = admin
// operador@geo.cl = operador
function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Complete correo y contraseña.");
    return;
  }

  if (email === "admin@geo.cl") {
    currentUser = {
      uid: "admin001",
      nombre: "Administrador",
      email,
      rol: "admin"
    };
  } else {
    currentUser = {
      uid: "op001",
      nombre: "Operador",
      email,
      rol: "operador"
    };
  }

  renderAppByRole();
}

function handleLogout() {
  currentUser = null;
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
  operadorPanel.classList.add("hidden");
  adminPanel.classList.add("hidden");
  loginForm.reset();
}

// --------- RENDER POR ROL ---------
function renderAppByRole() {
  if (!currentUser) return;

  loginView.classList.add("hidden");
  appView.classList.remove("hidden");

  userName.textContent = currentUser.nombre;
  roleBadge.textContent = currentUser.rol === "admin" ? "Administrador" : "Operador";

  operadorPanel.classList.add("hidden");
  adminPanel.classList.add("hidden");

  if (currentUser.rol === "admin") {
    adminPanel.classList.remove("hidden");
    setTimeout(() => {
      adminMap.invalidateSize();
      renderAdmin();
    }, 120);
  } else {
    operadorPanel.classList.remove("hidden");
    setTimeout(() => {
      operadorMap.invalidateSize();
    }, 120);
  }
}

// --------- CATEGORÍAS ---------
function initCategoryButtons() {
  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      categoryButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      categoriaSeleccionada.value = btn.dataset.categoria;
    });
  });
}

// --------- MAPAS ---------
function initMaps() {
  const center = [-33.4945, -70.706];

  operadorMap = L.map("operadorMap").setView(center, 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(operadorMap);

  adminMap = L.map("adminMap").setView(center, 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(adminMap);

  renderAdminMarkers(incidencias);
}

function obtenerUbicacion() {
  if (!navigator.geolocation) {
    alert("Tu navegador no soporta geolocalización.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      latitudInput.value = lat.toFixed(6);
      longitudInput.value = lng.toFixed(6);

      if (operadorMarker) {
        operadorMap.removeLayer(operadorMarker);
      }

      operadorMarker = L.marker([lat, lng]).addTo(operadorMap);
      operadorMap.setView([lat, lng], 17);
      operadorMarker.bindPopup("Ubicación actual").openPopup();
    },
    (error) => {
     
