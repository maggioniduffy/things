import type { Messages } from "..";
import { common } from "./common";

const brand = common.brand.name;

/** Spanish copy (rioplatense, voseo): auth. */
export const auth: Messages["auth"] = {
  errors: {
    invalidCode: "Ese código no funcionó. Revisalo o pedí uno nuevo.",
    rateLimit: "Demasiados intentos. Esperá un minuto y probá de nuevo.",
    captcha: "No pudimos verificar que sos una persona. Recargá la página y probá de nuevo.",
    network: `No podemos conectar con ${brand}. Revisá tu conexión y probá de nuevo.`,
    invalidEmail: "Ese email no parece correcto. Revisalo y probá de nuevo.",
    accountExists: `Ese email ya tiene una cuenta de ${brand}. Ingresá con ella — por ahora las cosas guardadas como invitado no se pasan.`,
    server: `${brand} no pudo hacerlo en este momento. Probá de nuevo en unos minutos.`,
    unknown: "Algo salió mal. Probá de nuevo.",
    callbackFailed: "No pudimos terminar de ingresarte. Probá de nuevo.",
  },
  login: {
    title: `Ingresá a ${brand}`,
    subtitle: "Te mandamos un código de 6 dígitos por email. ¿Primera vez? Así creás tu cuenta.",
    emailLabel: "Email",
    emailPlaceholder: "vos@ejemplo.com",
    sendCode: "Enviar código",
    sending: "Enviando…",
    checkEmailTitle: "Revisá tu email",
    checkEmailBody:
      "Los códigos vencen a los 10 minutos. ¿No llegó nada? Mirá en spam o pedí uno nuevo.",
    codeLabel: "Ingresá el código de 6 dígitos que enviamos a",
    verify: "Verificar",
    useDifferentEmail: "Usar otro email",
    resendIn: (seconds: number) => `Reenviar en ${seconds} s`,
    resend: "Reenviar código",
    or: "o",
    continueWithGoogle: "Seguir con Google",
    connecting: "Conectando…",
    homeLabel: `${brand}, inicio`,
  },
  guest: {
    start: "Probá sin cuenta",
    regionLabel: "Cuenta de invitado",
    defaultCopy: `Estás usando ${brand} como invitado. Sumá un email para no perder tus cosas.`,
    reminderCopy: (count: number) =>
      `Guardaste ${count} ${count === 1 ? "cosa" : "cosas"} como invitado. Sumá un email para no perderlas.`,
    keep: "Conservar mis cosas",
    dismiss: "Ocultar por ahora",
  },
  upgrade: {
    title: "Conservá tus cosas",
    description:
      "Sumá un email y te mandamos un código de 6 dígitos. Todo lo que guardaste queda donde está.",
    saved: (email: string) => `Tus cosas quedaron guardadas en ${email}.`,
    signInInstead: "Ingresar con esa cuenta",
    linkGoogle: "Vincular Google",
  },
};
