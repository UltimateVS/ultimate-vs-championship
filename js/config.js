/* =====================================================================
   CONFIGURACIÓN DE LA WEB DEL RETO
   Lo único que tienes que tocar aquí es SHEET_ID.
   ===================================================================== */
window.RETO_CONFIG = {
  // ID de tu Google Sheet: es el trozo de la URL entre /d/ y /edit
  // https://docs.google.com/spreadsheets/d/ESTO_ES_EL_ID/edit#gid=0
  SHEET_ID: 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET',

  // Carpeta de sprites y logos dentro del repo (no hace falta cambiarlo)
  ASSETS: 'assets',

  // Opcional: si algún día quieres congelar los datos, exporta cada pestaña a CSV
  // dentro de una carpeta del repo (ej. 'data') con el nombre de la pestaña
  // (Equipos.csv, Jornadas.csv...) y pon aquí 'data'. Si está vacío, lee el Google Sheet.
  DATA_DIR: ''
};
