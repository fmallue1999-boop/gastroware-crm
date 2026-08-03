"use client";

import { useEffect, useState } from "react";
import { guardarSuscripcionPush, borrarSuscripcionPush } from "@/lib/actions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushToggle() {
  const [estado, setEstado] = useState<
    "cargando" | "no-soportado" | "inactivo" | "activo" | "bloqueado"
  >("cargando");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEstado("no-soportado");
        return;
      }
      if (Notification.permission === "denied") {
        setEstado("bloqueado");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setEstado(sub ? "activo" : "inactivo");
    })();
  }, []);

  async function activar() {
    setError(null);
    try {
      const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!clave) {
        setError("Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en las variables de entorno.");
        return;
      }
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado("bloqueado");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(clave),
      });
      const res = await guardarSuscripcionPush(
        JSON.parse(JSON.stringify(sub))
      );
      if (res && "error" in res && res.error) {
        setError(res.error);
        await sub.unsubscribe();
        return;
      }
      setEstado("activo");
    } catch (e) {
      setError("No se pudo activar: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function desactivar() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await borrarSuscripcionPush(sub.endpoint);
      await sub.unsubscribe();
    }
    setEstado("inactivo");
  }

  return (
    <section className="rounded-2xl border border-borde bg-white shadow-sm p-4">
      <p className="text-sm font-semibold">Resumen matutino</p>
      <p className="mt-0.5 text-xs text-piedra">
        Todos los días a las 8:30: cuántos seguimientos vencidos y para hoy
        tenés, sin abrir la app.
      </p>
      <div className="mt-3">
        {estado === "cargando" && <p className="text-sm text-piedra">…</p>}
        {estado === "no-soportado" && (
          <p className="text-sm text-piedra">
            Este navegador no soporta notificaciones. En el celular, primero
            instalá la app (Agregar a pantalla de inicio).
          </p>
        )}
        {estado === "bloqueado" && (
          <p className="text-sm text-amber-700">
            Las notificaciones están bloqueadas para este sitio — habilitalas
            desde la configuración del navegador.
          </p>
        )}
        {estado === "inactivo" && (
          <button
            onClick={activar}
            className="rounded-2xl bg-tinta px-4 py-2 text-sm font-medium text-white"
          >
            Activar notificaciones
          </button>
        )}
        {estado === "activo" && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-green-700">✓ Activadas</span>
            <button
              onClick={desactivar}
              className="text-xs text-piedra underline"
            >
              Desactivar
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}
