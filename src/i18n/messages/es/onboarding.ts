import { common } from "./common";

const brand = common.brand.name;

/** Spanish copy: the first-visit tour. Must match en/onboarding.ts. */
export const onboarding = {
  skip: "Omitir",
  back: "Atrás",
  next: "Siguiente",
  finish: "Terminar",
  addEmail: "Agregar correo",
  progress: (step: number, total: number) => `Paso ${step} de ${total}`,
  showTour: "Mostrar el recorrido",
  steps: {
    welcome: {
      title: `Te damos la bienvenida a ${brand}`,
      body: `${brand} guarda enlaces, archivos y notas para más tarde. Todo lo que guardes se ordena solo por formato.`,
    },
    capture: {
      title: "Guarda lo que sea, rápido",
      body: "Pega en cualquier lugar con Ctrl+V, suelta archivos en la página o usa Agregar para escribir un enlace o una nota.",
    },
    organize: {
      title: "Mantén todo en orden",
      body: "Agrupa tus cosas en colecciones, ponles etiquetas y arrastra las tarjetas para moverlas. Las vistas inteligentes guardan un filtro que usas seguido.",
    },
    find: {
      title: "Encuéntralo otra vez",
      body: "Pulsa / para buscar; los errores de tipeo y las tildes no importan. Pulsa Ctrl+K para ver todos los comandos, J y K para moverte entre tarjetas, F para marcar favorita y E para archivar.",
    },
    canvas: {
      title: "Ordénalo en un lienzo",
      body: "Cambia una colección o la Bandeja de entrada a la vista de lienzo para colocar las tarjetas libremente, como en un tablero.",
    },
    settings: {
      title: "Tu configuración",
      body: "Bajo la tuerca puedes cambiar el idioma, repetir este recorrido y cerrar sesión.",
    },
    keep: {
      title: "Conserva tus cosas",
      body: "Eres invitado, así que tus cosas viven en la sesión de este navegador. Agrega tu correo para conservarlas y abrirlas desde cualquier lugar.",
    },
  },
};
