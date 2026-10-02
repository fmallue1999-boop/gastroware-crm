"use client";

import { useEffect } from "react";

/**
 * En el celular, mientras se escribe, marca la página con data-teclado para
 * esconder lo fijo de abajo (barra, botón +, totales) y dejarle lugar al
 * campo que se está completando (v1.12). Lo que tiene el foco no se esconde.
 *
 * iPhone: al cerrar el teclado la ventana a veces queda "achicada" y lo fijo
 * o pegado abajo (barra, botón +, caja de notas, totales) queda flotando a
 * mitad de pantalla.
 * - v1.20.1: se mide la parte visible (visualViewport) y, si su borde de abajo
 *   quedó más abajo que el de la ventana, se baja todo lo que tiene la clase
 *   .fijo-abajo esa diferencia (--ajuste-abajo).
 * - v1.21.2: además, cada vez que el teclado se cierra (y al volver a la app)
 *   se le da un toque mínimo al scroll para que el iPhone recalcule la
 *   ventana; antes solo se hacía si se detectaba el desfasaje.
 */
export default function TecladoAbierto() {
  useEffect(() => {
    const raiz = document.documentElement;
    const escribe = (el: EventTarget | null) =>
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLInputElement && !["checkbox", "radio", "file", "button", "submit", "range", "color"].includes(el.type));
    const celular = () => window.innerWidth < 1024;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tiempos: ReturnType<typeof setTimeout>[] = [];
    const vv = window.visualViewport;
    let cuadro = 0;
    let altoVisible = vv?.height ?? window.innerHeight;

    const desfasaje = () => (vv ? Math.round(vv.height + vv.offsetTop - window.innerHeight) : 0);
    const ajustar = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const dif = desfasaje();
        raiz.style.setProperty("--ajuste-abajo", !raiz.dataset.teclado && dif > 0 ? `${dif}px` : "0px");
      });
    };
    // Un píxel de scroll y de vuelta: no se ve, pero el iPhone recalcula la ventana
    const reacomodar = () => {
      if (!celular() || raiz.dataset.teclado) return;
      const y = window.scrollY;
      const otro = y > 0 ? y - 1 : y + 1;
      window.scrollTo(window.scrollX, otro);
      window.scrollTo(window.scrollX, y);
      ajustar();
    };
    const despuesDelTeclado = () => {
      tiempos.splice(0).forEach(clearTimeout);
      // El teclado tarda en bajar: se reacomoda al toque y otra vez cuando terminó
      tiempos.push(setTimeout(reacomodar, 60), setTimeout(reacomodar, 450), setTimeout(reacomodar, 900));
    };

    const entra = (e: FocusEvent) => {
      if (timer) clearTimeout(timer);
      if (celular() && escribe(e.target)) raiz.dataset.teclado = "1";
    };
    // Al pasar de un campo a otro no parpadea: espera un toque antes de mostrar
    const sale = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (escribe(document.activeElement)) return;
        const teniaTeclado = Boolean(raiz.dataset.teclado);
        delete raiz.dataset.teclado;
        ajustar();
        if (teniaTeclado) despuesDelTeclado();
      }, 150);
    };
    // La parte visible creció mucho de golpe (se fue el teclado): reacomodar
    const cambioVisible = () => {
      ajustar();
      const alto = vv?.height ?? window.innerHeight;
      if (alto - altoVisible > 120 && !raiz.dataset.teclado) despuesDelTeclado();
      altoVisible = alto;
    };
    const vuelve = () => {
      if (document.visibilityState === "visible") despuesDelTeclado();
    };

    document.addEventListener("focusin", entra);
    document.addEventListener("focusout", sale);
    document.addEventListener("visibilitychange", vuelve);
    window.addEventListener("pageshow", vuelve);
    vv?.addEventListener("resize", cambioVisible);
    vv?.addEventListener("scroll", ajustar);
    window.addEventListener("resize", ajustar);
    window.addEventListener("orientationchange", despuesDelTeclado);
    return () => {
      document.removeEventListener("focusin", entra);
      document.removeEventListener("focusout", sale);
      document.removeEventListener("visibilitychange", vuelve);
      window.removeEventListener("pageshow", vuelve);
      vv?.removeEventListener("resize", cambioVisible);
      vv?.removeEventListener("scroll", ajustar);
      window.removeEventListener("resize", ajustar);
      window.removeEventListener("orientationchange", despuesDelTeclado);
      if (timer) clearTimeout(timer);
      tiempos.forEach(clearTimeout);
      cancelAnimationFrame(cuadro);
      delete raiz.dataset.teclado;
      raiz.style.removeProperty("--ajuste-abajo");
    };
  }, []);
  return null;
}
