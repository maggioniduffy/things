import type { Messages } from "..";

/** La paleta ⌘K: resultados de búsqueda, acciones y accesos directos. */
export const palette: Messages["palette"] = {
  placeholder: "Buscá cosas, ejecutá un comando o andá a…",
  untitled: "Sin título",
  empty: "Sin coincidencias.",
  searching: "Buscando…",
  searchFailed: "No pudimos buscar tus cosas.",
  groups: {
    results: "Resultados",
    actions: "Acciones",
    goTo: "Ir a",
  },
  actions: {
    addItem: "Agregar cosa",
    saveClipboard: "Guardar portapapeles",
    open: "Abrir",
    favorite: "Agregar a favoritos",
    unfavorite: "Quitar de favoritos",
    archive: "Archivar",
    unarchive: "Desarchivar",
    trash: "Mover a la papelera",
    moveTo: "Mover a colección…",
    addTag: "Agregar etiqueta…",
  },
  go: {
    inbox: "Bandeja de entrada",
    all: "Todo",
    unread: "Sin leer",
    favorites: "Favoritos",
    archive: "Archivo",
    trash: "Papelera",
  },
  clipboardDenied: "No pudimos leer el portapapeles. Permití el acceso e intentá de nuevo.",
  clipboardEmpty: "El portapapeles está vacío.",
};
