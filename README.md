# GeoCámaras

Aplicación web/PWA para registrar cámaras georreferenciadas en terreno, con autenticación de usuarios, base compartida en Firebase y visualización en mapa Leaflet.

## Funciones actuales

- Inicio de sesión con correo y contraseña
- Registro rápido de cámaras por tipo
- Captura de ubicación GPS
- Observación y referencia opcional
- Visualización compartida en mapa
- Listado compartido de registros
- Sincronización en tiempo real con Firestore

## Estructura de Firestore

### Colección: usuarios
Documento ID = UID del usuario autenticado

Campos:
- nombre
- correo
- rol
- activo
- creadoEn

### Colección: camaras
Campos:
- type
- lat
- lng
- observacion
- referencia
- createdAt
- updatedAt
- usuarioUid
- usuarioNombre
- estado
- validado

## Configuración Firebase

Crear archivo `firebase-config.js` con:

```javascript
export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
