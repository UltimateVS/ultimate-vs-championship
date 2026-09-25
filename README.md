# Web del reto Pokémon — guía de montaje

La web es una página estática (HTML + CSS + JS) que se publica gratis con **GitHub Pages**.
Lee los datos en directo de tu **Google Sheet** y los sprites de la carpeta **assets/** del repo.
Cada vez que actualizas el sheet, basta con recargar la web.

```
tu-repo/
├── index.html
├── css/styles.css
├── js/config.js      ← aquí va el ID de tu Google Sheet
├── js/data.js        ← lee el sheet y calcula resultados, puntos, clasificación...
├── js/app.js         ← pinta las 6 páginas
├── .nojekyll
└── assets/           ← tu carpeta de assets (pokemon, megas, items, equipos, galeria)
```

---

## 1 · Crear el Google Sheet

1. Sube `Reto_Pokemon_datos_web.xlsx` a tu Google Drive.
2. Ábrelo y ve a **Archivo → Guardar como Hojas de cálculo de Google**. Trabaja siempre sobre esa copia; el .xlsx lo puedes borrar.
3. **Compartir → Acceso general → Cualquier persona con el enlace → Lector.** Sin esto, la web no puede leer los datos.
4. Copia el **ID** de la URL. Es el trozo entre `/d/` y `/edit`:
   `https://docs.google.com/spreadsheets/d/`**`1AbC...xyz`**`/edit`

> No cambies el nombre de las pestañas ni insertes o borres columnas: la web lee las columnas por su posición.
> Sí puedes añadir filas de reglas en Historia y fotos en la galería.

## 2 · Crear el repositorio en GitHub

1. Crea una cuenta en github.com, si no la tienes.
2. **New repository** → nombre, por ejemplo `liga-pokemon` → **Public** → Create.
3. Sube los archivos. Como `assets/` tiene más de 1.000 imágenes y la subida por web solo admite 100 archivos a la vez, lo más cómodo es **GitHub Desktop** (desktop.github.com):
   - **File → Clone repository** → elige `liga-pokemon` y una carpeta de tu ordenador.
   - Copia en esa carpeta todo el contenido de este zip **y** tu carpeta `assets` completa, al lado de `index.html`.
   - En GitHub Desktop: escribe un mensaje (ej. "Primera versión") → **Commit to main** → **Push origin**.

## 3 · Conectar la web con el sheet

1. En GitHub, abre `js/config.js` → icono del lápiz (Edit).
2. Sustituye `PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET` por el ID del paso 1.4.
3. **Commit changes**.

## 4 · Publicar con GitHub Pages

1. En el repo: **Settings → Pages**.
2. **Source: Deploy from a branch** · **Branch: main** · carpeta **/ (root)** → **Save**.
3. En 1–2 minutos la web estará en `https://TU-USUARIO.github.io/liga-pokemon/`.

---

## Uso del día a día

| Quieres… | Dónde |
|---|---|
| Apuntar un combate | Sheet → **Enfrentamientos** (plantilla del combate) |
| Poner fecha, hora o repeticiones | Sheet → **Jornadas** |
| Premios de la jornada | Sheet → **Insignias** (cuando termine la jornada) |
| Textos de los equipos o Hall de la Fama | Sheet → **Equipos** |
| Historia, reglas, galería | Sheet → **Historia** |
| Añadir una foto a la galería | Sube el archivo a `assets/galeria/` en GitHub y añade su fila en Historia → Galería |
| Añadir un sprite nuevo | Súbelo a su carpeta de `assets/` y añade el nombre al final de su columna en **Listas** |

Los resultados, puntos, clasificación, diferencial de KOs, ranking de kills, balance y medallas se calculan solos.

## Si algo falla

- **"No se han podido cargar los datos"** → revisa el ID en `js/config.js` y que el sheet esté compartido como *Cualquier persona con el enlace · Lector*.
- **No sale un sprite o un logo** → el nombre del archivo no coincide con lo escrito en el sheet. En GitHub, las mayúsculas y minúsculas cuentan.
- **Logo de SSUR**: es `ssur.jfif`. Conviene convertirlo a `ssur.jpg` y cambiar el nombre en Equipos → columna Logo.
- **Un cambio del sheet no aparece** → espera un minuto y recarga la web (Ctrl+F5).
