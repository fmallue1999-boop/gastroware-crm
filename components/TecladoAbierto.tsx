"use client";

import { useEffect } from "react";

/**
 * En el celular, mientras se escribe, marca la página con data-teclado para
 * esconder lo fijo de abajo (barra, botón +, totales) y dejarle lugar al
 * campo que se está completando (v1.12). Lo que tiene el foco no se esconde.
 */
export default function TecladoAbierto() {
  useEffect(() => {
    const raiz = document.documentElement;
    const escribe = (el: EventTarget | null) =>
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLInputElement && !["checkbox", "radio", "file", "button", "submit", "range", "color"].includes(el.type));
    let timer: ReturnType<typeof setTimeout> | null = null;
    const entra = (e: FocusEvent) => {
      if (timer) clearTimeout(timer);
      if (window.innerWidth < 1024 && escribe(e.target)) raiz.dataset.teclado = "1";
    };
    // Al pasar de un campo a otro no parpadea: espera un toque antes de mostrar
    const sale = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!escribe(document.activeElement)) delete raiz.dataset.teclado;
      }, 150);
    };
    document.addEventListener("focusin", entra);
    document.addEventListener("focusout", sale);
    return () => {
      document.removeEventListener("focusin", entra);
      document.removeEventListener("focusout", sale);
      delete raiz.dataset.teclado;
    };
  }, []);
  return null;
}
