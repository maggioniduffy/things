import type { Messages } from "..";
import { common } from "./common";

const brand = common.brand.name;

/** Spanish copy (rioplatense, voseo): marketing. */
export const marketing: Messages["marketing"] = {
  nav: {
    label: "Secciones de la página",
    howItWorks: "Cómo funciona",
    features: "Funciones",
    faq: "Preguntas frecuentes",
  },
  entry: { signIn: "Ingresar", openApp: "Abrir la app" },
  hero: {
    title: "Guardá lo que quieras. Encontralo de nuevo.",
    lead: `Soltá enlaces, archivos y notas. ${brand} los ordena por formato y te los deja a mano.`,
  },
  how: {
    title: "Cómo funciona",
    steps: [
      {
        title: "Guardá en un gesto",
        body: "Pegá un enlace, soltá un archivo o anotá algo. Se guarda al instante, sin formularios.",
      },
      {
        title: "Orden sin esfuerzo",
        body: "Cada cosa se ordena por formato y, un momento después, suma título, imagen y miniatura.",
      },
      {
        title: "Encontralo de nuevo",
        body: "Buscá, filtrá por formato, etiqueta o estado, y abrí cualquier cosa para verla completa.",
      },
    ],
  },
  features: {
    eyebrow: "Funciones",
    title: "Ordenado antes de que lo pienses",
    lead: `${brand} mira cada cosa que guardás y la ordena por formato, así tu tablero ya tiene sentido. Las colecciones, etiquetas y vistas inteligentes están para cuando quieras más.`,
    formatsTitle: "Ordenado por formato, solo",
    formatsLabel: "Formatos",
    formats: {
      link: "Enlaces",
      article: "Artículos",
      video: "Videos",
      image: "Imágenes",
      pdf: "PDFs",
      document: "Documentos",
      note: "Notas",
      code: "Código",
    },
    items: {
      capture: {
        title: "Guardá desde donde sea",
        body: "Pegá en el tablero, arrastrá archivos y enlaces desde tu escritorio u otra pestaña, o usá el agregado rápido. Podés guardar hasta 20 cosas de una vez.",
      },
      previews: {
        title: "Vistas previas completas",
        body: "Los enlaces se vuelven tarjetas con título, descripción, imagen y nombre del sitio. Las imágenes, PDFs y videos tienen miniatura.",
      },
      collections: {
        title: "Colecciones y etiquetas",
        body: "Dale a cada cosa un hogar en una colección con su propio emoji y color, y todas las etiquetas que quieras. Escribí #etiqueta en un título o nota para sumar una.",
      },
      smartViews: {
        title: "Vistas inteligentes",
        body: "Guardá un filtro, como los PDFs sin abrir con la etiqueta #tesis, y queda en la barra lateral, siempre al día.",
      },
      drag: {
        title: "Arrastrá para ordenar",
        body: "Reordená las tarjetas a mano, o arrastrá una o varias a una colección, una etiqueta, Favoritos, Archivo o la Papelera. También con el teclado.",
      },
      layouts: {
        title: "Cuadrícula, lista o lienzo",
        body: "Mirá todo en tarjetas o en filas compactas, o armá una colección en su propio lienzo infinito, donde las cosas quedan donde las dejás.",
      },
      drawer: {
        title: "Detalles en un panel",
        body: "Abrí cualquier cosa para ver una vista previa grande, editar el título y la nota, y ver sus etiquetas y su origen. Cada panel tiene su propio enlace.",
      },
      safety: {
        title: "Nada se pierde por accidente",
        body: "Marcá cosas como leídas, favoritas o archivalas. Lo eliminado espera 30 días en la Papelera, y toda acción destructiva se puede deshacer.",
      },
    },
  },
  guest: {
    eyebrow: "Modo invitado",
    title: "Probalo sin cuenta",
    lead: `Con un clic tenés un tablero privado. Creá una cuenta solo cuando ${brand} se lo haya ganado.`,
    facts: [
      { term: "Sin registro", detail: "Empezá a guardar ya mismo. Sin email ni contraseña." },
      {
        term: "La misma app",
        detail:
          "Los invitados tienen todas las funciones, con archivos de hasta 10 MB cada uno y 25 MB en total.",
      },
      {
        term: "Conservá todo",
        detail: "Sumá tu email más tarde y todo lo que guardaste queda exactamente donde está.",
      },
    ],
  },
  faq: {
    eyebrow: "Preguntas frecuentes",
    title: "Preguntas y respuestas",
    items: [
      {
        question: "¿Qué puedo guardar?",
        answer:
          "Enlaces, artículos, videos, imágenes, PDFs, documentos, código y notas de texto. Todo lo demás se guarda como archivo.",
      },
      {
        question: "¿Tengo que ordenar sobre la marcha?",
        answer:
          "No. Lo nuevo va a tu Bandeja de entrada y ya viene agrupado por formato. Pasalo a colecciones o etiquetalo cuando te venga bien.",
      },
      {
        question: "¿Quién puede ver mis cosas?",
        answer:
          "Solo vos. Cada cuenta es de una sola persona, y cada cosa y archivo es privado para la cuenta que lo guardó.",
      },
      {
        question: "¿Qué tamaño pueden tener los archivos?",
        answer:
          "Hasta 50 MB por archivo con cuenta. Los invitados pueden subir archivos de hasta 10 MB cada uno y 25 MB en total.",
      },
      {
        question: "¿Qué pasa con mis cosas de invitado cuando me registro?",
        answer:
          "No se mueve nada. Al sumar tu email, tu tablero de invitado se vuelve una cuenta completa, con todo en su lugar.",
      },
      {
        question: "¿Cómo ingreso?",
        answer:
          "Con un código de 6 dígitos que te mandamos por email. No hay contraseña que recordar.",
      },
    ],
  },
  cta: {
    title: "Tu próxima cosa está a un pegado de distancia",
    lead: "Empezá como invitado y conservá todo cuando te registres.",
  },
};
