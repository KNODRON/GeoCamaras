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

const logoutBtn = document.getElementById("logoutBtn");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const adminName = document.getElementById("adminName");

const tablaBody = document.getElementById("tablaIncidenciasBody");
const filtroCategoria = document.getElementById("filtroCategoria");
const filtroEstado = document.getElementById("filtroEstado");

let allIncidencias = [];
let currentUser = null;

requireRole("admin", async (user, profile) => {
  currentUser = user;
  adminName.textContent = `${profile.nombre || user.email} · Administrador`;
  bindEvents();
  await loadIncidencias();
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

changePasswordBtn.addEventListener("click", async () => {
  await sendPasswordResetEmail(auth, currentUser.email);
  alert("Correo de cambio de contraseña enviado");
});

function bindEvents() {
  filtroCategoria.addEventListener("change", renderAll);
  filtroEstado.addEventListener("change", renderAll);
}

async function loadIncidencias() {
  const q = query(collection(db, "incidencias"), orderBy("fecha", "desc"));
  const snapshot = await getDocs(q);

  allIncidencias = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  renderAll();
}

function getFilteredIncidencias() {
  const categoria = filtroCategoria.value;
  const estado = filtroEstado.value;

  return allIncidencias.filter((item) => {
    return (!categoria || item.categoria === categoria) &&
           (!estado || item.estado === estado);
  });
}

function getEstadoClass(estado) {
  if (estado === "pendiente") return "estado-pendiente";
  if (estado === "en_proceso") return "estado-en-proceso";
  if (estado === "resuelto") return "estado-resuelto";
  return "";
}

function renderAll() {
  const items = getFilteredIncidencias();
  renderTable(items);
}

function renderTable(items) {
  tablaBody.innerHTML = "";

  items.forEach((item) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${item.categoria}</td>
      <td>${item.descripcion}</td>
      <td>${item.direccion || "-"}</td>
      <td>
        <select class="estado-select ${getEstadoClass(item.estado)}" data-id="${item.id}">
          <option value="pendiente" ${item.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
          <option value="en_proceso" ${item.estado === "en_proceso" ? "selected" : ""}>En proceso</option>
          <option value="resuelto" ${item.estado === "resuelto" ? "selected" : ""}>Resuelto</option>
        </select>
      </td>
      <td>${formatFecha(item.fecha)}</td>
    `;

    tablaBody.appendChild(tr);
  });

  document.querySelectorAll(".estado-select").forEach((select) => {
    aplicarColor(select);

    select.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const nuevoEstado = e.target.value;

      aplicarColor(e.target);

      await updateDoc(doc(db, "incidencias", id), {
        estado: nuevoEstado
      });

      const item = allIncidencias.find(i => i.id === id);
      if (item) item.estado = nuevoEstado;
    });
  });
}

function aplicarColor(select) {
  select.classList.remove("estado-pendiente", "estado-en-proceso", "estado-resuelto");
  select.classList.add(getEstadoClass(select.value));
}

function formatFecha(timestamp) {
  if (!timestamp) return "-";
  const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return fecha.toLocaleString("es-CL");
}
