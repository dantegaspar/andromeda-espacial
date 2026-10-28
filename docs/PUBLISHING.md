# Publicar Andromeda Espacial para Antigravity IDE

La instalación de Antigravity IDE revisada usa `https://open-vsx.org/vscode/gallery`. Los temas de este formato se publican en **Open VSX**, por separado del marketplace de plugins de agentes.

1. Crea una [cuenta Eclipse](https://accounts.eclipse.org/) e indica tu usuario de GitHub.
2. Inicia sesión en [Open VSX](https://open-vsx.org/) con ese mismo GitHub. En [tu perfil](https://open-vsx.org/user-settings/profile), vincula Eclipse y acepta personalmente el **Publisher Agreement**.
3. Genera un token en **Settings → Access Tokens**. Guárdalo fuera del repositorio. El token de Open VSX es distinto al de GitHub.
4. Configura el token con una entrada oculta en tu sesión; por ejemplo, en zsh:

   ```sh
   read -rs 'OVSX_PAT?Token Open VSX: '
   export OVSX_PAT
   npx ovsx@1.3.0 create-namespace miandromeda
   ```

   El namespace debe coincidir con `publisher` en `package.json`. Si ya existe,
   necesitas permiso para publicar en él.

5. Desde la raíz del proyecto:

   ```sh
   npm ci
   npm test
   npm run package
   npx ovsx@1.3.0 publish dist/andromeda-espacial-1.1.0.vsix
   unset OVSX_PAT
   ```

6. Confirma el resultado en Open VSX y busca `miandromeda.andromeda-espacial` en Antigravity IDE. Para futuras versiones, aumenta `version` antes de empaquetar.

El estado verificado del namespace se tramita por separado; no es automático al crearlo.

Fuentes oficiales: [publicación de extensiones](https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions), [acceso a namespaces](https://github.com/eclipse-openvsx/openvsx/wiki/Namespace-Access) y [CLI ovsx](https://github.com/eclipse-openvsx/openvsx/tree/master/cli).
