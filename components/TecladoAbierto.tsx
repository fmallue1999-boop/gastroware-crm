"use client";

import { useEffect } from "react";

/**
 * En el celular, mientras se escribe, marca la página con data-teclado para
 * esconder lo fijo de abajo (barra, botón +, totales) y dejarle lugar al
 * campo que se está completando (v1.12). Lo que tiene el foco no se esconde.
 *
 * v1.20.1: en el iPhone, al cerrar el teclado la ventana a veces queda
 * "achicada" y lo fijo de abajo (barra, botón +) queda flotando a mitad de
 * pantalla. Se mide la parte visible (visualViewport) y, si su borde de abajo
 * quedó más abajo que el de la ventana, se baja lo fijo esa diferencia
 * (--ajuste-abajo, clase .fijo-abajo) y se le da un toque al scroll para que
 * el iPhone se reacomode.
 */
export default function TecladoAbierto() {
  useEffect(() => {
    const raiz = document.documentElement;
    const escribe = (el: EventTarget | null) =>
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLInputElement && !["checkbox", "radio", "file", "button", "submit", "range", "color"].includes(el.type));
    let timer: ReturnType<typeof setTimeout> | null = null;
    const vv = window.visualViewport;
    let cuadro = 0;
    const desfasaje = () => (vv ? Math.round(vv.height + vv.offsetTop - window.innerHeight) : 0);
    const ajustar = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const dif = desfasaje();
        raiz.style.setProperty("--ajuste-abajo", !raiz.dataset.teclado && dif > 0 ? `${dif}px` : "0px");
      });
    };
    const entra = (e: FocusEvent) => {
      if (timer) clearTimeout(timer);
      if (window.innerWidth < 1024 && escribe(e.target)) raiz.dataset.teclado = "1";
    };
    // Al pasar de un campo a otro no parpadea: espera un toque antes de mostrar
    const sale = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (escribe(document.activeElement)) return;
        delete raiz.dataset.teclado;
        ajustar();
        // Cuando el teclado ya bajó: si quedó desfasado, un toque al scroll lo reacomoda
        setTimeout(() => {
          if (desfasaje() > 0) {
            window.scrollBy(0, 1);
            window.scrollBy(0, -1);
          }
          ajustar();
        }, 350);
      }, 150);
    };
    document.addEventListener("focusin", entra);
    document.addEventListener("focusout", sale);
    vv?.addEventListener("resize", ajustar);
    vv?.addEventListener("scroll", ajustar);
    window.addEventListener("resize", ajustar);
    return () => {
      document.removeEventListener("focusin", entra);
      document.removeEventListener("focusout", sale);
      vv?.removeEventListener("resize", ajustar);
      vv?.removeEventListener("scroll", ajustar);
      window.removeEventListener("resize", ajustar);
      cancelAnimationFrame(cuadro);
      delete raiz.dataset.teclado;
      raiz.style.removeProperty("--ajuste-abajo");
    };
  }, []);
  return null;
}
