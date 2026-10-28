# Extras visuales opcionales

Estos scripts modifican la instalación local del IDE. No forman parte del paquete de la tienda ni se ejecutan al instalar el tema.

## Cosmic Andromeda en macOS y Apple Silicon

El tema funciona sin código nativo adicional. Los cuatro temas permiten un
fondo transparente en xterm, conservando su texto y cursor opacos. El panel
acoplado conserva un fondo oscuro. El parche opcional conserva las estrellas en una textura SVG
repetible y los bordes neón, sin animaciones en reposo ni capas de destellos
sobre el editor. No fuerza capas con `will-change` ni altera los canvas de xterm.

Con Node.js 18 o posterior, desde esta carpeta:

```sh
# Recomendado para batería: efectos estáticos; no instala JavaScript de actividad.
npm run patch

# Opcional: bordes animados durante ráfagas de 1.8 s al interactuar.
npm run patch:animated

# Ver el código detrás de la terminal inferior:
npm run patch:overlay

# Retirar los recursos y enlaces del parche.
npm run restore

# Para otra ubicación del IDE:
node scripts/patch-neon.mjs --app "/Applications/Antigravity IDE.app"
```

Después de instalar, cambiar de modo o restaurar, ejecuta **Developer: Reload
Window** en Antigravity IDE. El modo animado escucha eventos de teclado, clic,
scroll, foco y visibilidad; no hace polling. Detiene los efectos al perder el
foco, ocultarse la ventana o activar `prefers-reduced-motion`. También respeta
`monaco-reduce-motion`, `.nosidebar` y `.nopanel`. No pausa animaciones del IDE.
La detección de ventanas cubiertas depende de la configuración de Electron.

### Terminal sobre el código

`npm run patch:overlay` instala el controlador que coloca la terminal inferior
sobre la parte baja del editor. Su fondo oscuro tiene una opacidad de 55%; el
texto y el cursor de la terminal mantienen su opacidad original. No usa blur,
capturas ni copias del código. El botón **Acoplar / Superponer** en la cabecera
permite cambiar de posición durante la sesión.

Este modo mantiene el tamaño y el espacio que el IDE reserva al panel inferior;
no amplía el editor ni modifica el gestor interno de distribución. Solo se
superpone mientras la terminal inferior está visible y el editor tiene espacio;
Salida, Problemas y paneles laterales/maximizados mantienen su posición nativa.
Para retirar este modo, vuelve a ejecutar `npm run patch` y recarga la ventana.
Puede combinarse con bordes animados: `npm run patch -- --terminal-overlay --animated`.
La transparencia puede quedar anulada si tienes una personalización propia de
`terminal.background`; para ver el código debe permitir alfa transparente.

El instalador modifica recursos dentro del bundle de la aplicación, actualiza
el checksum del HTML y aplica una firma ad hoc conservando la metadata y las
firmas del código anidado. No elimina atributos de cuarentena. Verifica la firma
con `codesign --verify --deep --strict` y devuelve un error si falla. Si falla la
instalación, revierte los archivos de esa ejecución; una firma parcialmente
modificada puede requerir reparación. Una instalación idéntica no reescribe
archivos ni vuelve a firmar, pero sí verifica la firma.

Si macOS devuelve `EPERM`, revisa **Ajustes del Sistema → Privacidad y seguridad
→ Gestión de aplicaciones**. Autoriza la aplicación que ejecuta el comando:
Terminal/iTerm si es una ventana independiente, o el IDE si es su terminal
integrada. Cierra y vuelve a abrir esa aplicación después de cambiar el permiso.
También puedes abrir **Terminal** desde Aplicaciones → Utilidades, habilitar
su permiso y ejecutar allí el instalador desde esta carpeta. Si macOS muestra
una solicitud al volver a ejecutar el comando, selecciona **Permitir** y repite
el comando si fuera necesario.

El instalador comprueba cada directorio creando y retirando un archivo temporal
antes de modificar los recursos del IDE. Así verifica una escritura real en vez
de depender de `access(W_OK)`. Distingue `EPERM` de `EACCES`, que requiere revisar
propietario, permisos o ACL. No solicita `sudo` ni cambia permisos del sistema.

La restauración retira solo los enlaces y recursos de Cosmic Andromeda y
recalcula el checksum actual. Conserva otros cambios y no usa los `.bak` antiguos
del instalador anterior. No recupera la firma original del proveedor ni cambia
el tema seleccionado. Tras una actualización del IDE, vuelve a ejecutar el
instalador si se han reemplazado sus recursos.

### Validación

```sh
npm test
```

Las pruebas usan directorios temporales y una firma simulada; cubren migración
del enlace antiguo, idempotencia, cambios solo de CSS, cambio de modo,
restauración sobre archivos actualizados, modo de superposición, reversión ante errores y pausa de
actividad. No ejecutan el IDE ni cuantifican ahorro energético.

Para medir el efecto real, compara tema base, parche estático y modo animado
en el mismo proyecto y pantalla: reposo, scroll, salida de terminal y ventana
cubierta/minimizada. Observa CPU, memoria e impacto energético en Monitor de
Actividad, y las capas/repintados en las herramientas de desarrollo del IDE.
No se garantiza un porcentaje de ahorro sin esa medición.
