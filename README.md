# Andromeda Espacial

Tema oscuro personalizado basado en [Andromeda de Eliver Lara](https://github.com/EliverLara/Andromeda), preparado para Antigravity IDE y editores compatibles con temas de VS Code.

![Vista del tema base Andromeda](images/andromeda.png)

La imagen muestra el tema base del que parte esta personalización.

## Variantes

- **Andromeda Espacial**
- **Andromeda Espacial Bordered**
- **Andromeda Espacial Italic**
- **Andromeda Espacial Italic Bordered**

Incluye colores semánticos, acentos turquesa, violeta, naranja y amarillo, y colores de terminal. El paquete de tienda es declarativo: no ejecuta código ni modifica la aplicación. No incluye binarios nativos y es compatible con Apple Silicon.

## Instalación

Cuando esté publicado en Open VSX, busca **Andromeda Espacial** en Extensiones de Antigravity IDE. El identificador previsto es `miandromeda.andromeda-espacial`.

También puedes instalar el archivo `.vsix` desde **Extensions: Install from VSIX…** en la paleta de comandos.

Después abre **Preferences: Color Theme** y elige una de las cuatro variantes.

## Desarrollo

Requiere Node.js 22 o posterior para las herramientas de empaquetado.

```sh
npm ci
npm test
npm run package
```

El paquete se genera en `dist/andromeda-espacial-1.0.0.vsix`. El manifiesto se genera al empaquetar; no se mantiene un `.vsixmanifest` manual.

## Publicación

Consulta [los pasos para publicar en Open VSX](docs/PUBLISHING.md), el catálogo configurado en Antigravity IDE.

## Extras visuales

Los [extras Cosmic Andromeda](docs/COSMIC.md) son scripts locales opcionales para macOS. Modifican recursos del IDE, requieren permiso de Gestión de aplicaciones y no están incluidos en el `.vsix`. Las estrellas, animaciones y la terminal superpuesta no se instalan con el tema de la tienda.

## Créditos y licencia

Personalización mantenida por Dante. Basada en [Andromeda](https://github.com/EliverLara/Andromeda) y en su [fork para Open VSX](https://github.com/FelixIcaza/Andromeda).

Licencia [MIT](LICENSE.md). Se conserva el aviso de copyright original de Eliver Lara.
