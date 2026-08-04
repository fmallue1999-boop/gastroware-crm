"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Upload } from "lucide-react";
import { importarClientes, type FilaImport } from "@/lib/actions";

const CAMPOS = [
  { value: "", label: "— Ignorar columna —" },
  { value: "nombre_comercial", label: "Nombre del negocio (obligatorio)" },
  { value: "razon_social", label: "Razón social" },
  { value: "cuit", label: "CUIT" },
  { value: "condicion_fiscal", label: "Condición fiscal" },
  { value: "rubro", label: "Rubro" },
  { value: "telefono", label: "Teléfono / WhatsApp" },
  { value: "email", label: "Email" },
  { value: "ciudad", label: "Ciudad" },
  { value: "provincia", label: "Provincia" },
  { value: "direccion", label: "Dirección" },
  { value: "notas", label: "Notas" },
] as const;

const SINONIMOS: Record<string, string[]> = {
  nombre_comercial: ["nombre", "cliente", "negocio", "nombre comercial", "comercio", "local", "fantasia", "nombre fantasia"],
  razon_social: ["razon social", "razon"],
  cuit: ["cuit", "cuil", "cuit cuil"],
  condicion_fiscal: ["condicion fiscal", "cond fiscal", "iva", "condicion iva"],
  rubro: ["rubro", "categoria", "actividad", "tipo"],
  telefono: ["telefono", "tel", "celular", "cel", "whatsapp", "movil", "telefono 1"],
  email: ["email", "mail", "correo", "e mail"],
  ciudad: ["ciudad", "localidad"],
  provincia: ["provincia", "prov"],
  direccion: ["direccion", "domicilio", "calle"],
  notas: ["notas", "observaciones", "obs", "comentarios", "comentario"],
};

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function adivinarCampo(encabezado: string): string {
  const h = normalizar(encabezado);
  if (!h) return "";
  for (const [campo, sins] of Object.entries(SINONIMOS)) {
    if (sins.includes(h)) return campo;
  }
  for (const [campo, sins] of Object.entries(SINONIMOS)) {
    if (sins.some((s) => h.includes(s) || s.includes(h))) return campo;
  }
  return "";
}

type Estado =
  | { paso: "elegir" }
  | { paso: "mapear"; encabezados: string[]; filas: string[][]; mapeo: string[] }
  | { paso: "importando"; hechas: number; total: number }
  | {
      paso: "listo";
      creados: number;
      salteados: number;
      errores: string[];
    };

export default function ImportadorClientes() {
  const [estado, setEstado] = useState<Estado>({ paso: "elegir" });
  const [estadoCliente, setEstadoCliente] = useState<"cliente_activo" | "prospecto">(
    "cliente_activo"
  );
  const [error, setError] = useState<string | null>(null);

  async function leerArchivo(archivo: File) {
    setError(null);
    try {
      const XLSX = await import("xlsx");
      const buffer = await archivo.arrayBuffer();
      const libro = XLSX.read(buffer, { type: "array" });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
        header: 1,
        raw: false,
        defval: "",
      }) as string[][];
      const noVacias = matriz.filter((f) =>
        f.some((c) => String(c ?? "").trim() !== "")
      );
      if (noVacias.length < 2) {
        setError("El archivo está vacío o solo tiene la fila de títulos.");
        return;
      }
      const encabezados = noVacias[0].map((c) => String(c ?? "").trim());
      const filas = noVacias
        .slice(1)
        .map((f) => encabezados.map((_, i) => String(f[i] ?? "").trim()));
      if (filas.length > 3000) {
        setError("Máximo 3000 filas por archivo. Partilo en dos.");
        return;
      }
      setEstado({
        paso: "mapear",
        encabezados,
        filas,
        mapeo: encabezados.map(adivinarCampo),
      });
    } catch {
      setError("No pude leer el archivo. Guardalo como .xlsx o .csv y probá de nuevo.");
    }
  }

  async function importar() {
    if (estado.paso !== "mapear") return;
    const { encabezados, filas, mapeo } = estado;
    if (!mapeo.includes("nombre_comercial")) {
      setError('Marcá qué columna es el "Nombre del negocio".');
      return;
    }
    setError(null);

    const objetos: FilaImport[] = filas.map((f) => {
      const o: Record<string, string> = {};
      mapeo.forEach((campo, i) => {
        if (campo && f[i]) o[campo] = o[campo] ? `${o[campo]} ${f[i]}` : f[i];
      });
      return o as unknown as FilaImport;
    });

    let creados = 0;
    let salteados = 0;
    const errores: string[] = [];
    const TANDA = 100;
    for (let i = 0; i < objetos.length; i += TANDA) {
      setEstado({ paso: "importando", hechas: i, total: objetos.length });
      const res = await importarClientes(objetos.slice(i, i + TANDA), {
        estado: estadoCliente,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        setEstado({
          paso: "mapear",
          encabezados,
          filas,
          mapeo,
        });
        return;
      }
      if (res && "creados" in res) {
        creados += res.creados ?? 0;
        salteados += res.salteados ?? 0;
        errores.push(...(res.errores ?? []));
      }
    }
    setEstado({ paso: "listo", creados, salteados, errores });
  }

  if (estado.paso === "elegir") {
    return (
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-borde bg-white p-10 text-center shadow-sm hover:border-celeste">
          <FileSpreadsheet className="h-8 w-8 text-piedra" />
          <span className="text-sm font-medium">
            Tocá acá y elegí tu archivo de Excel o CSV
          </span>
          <span className="text-xs text-piedra">
            Sirve el listado que tengas: la primera fila tienen que ser los
            títulos de las columnas (Nombre, Teléfono, CUIT…)
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void leerArchivo(f);
            }}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  if (estado.paso === "importando") {
    return (
      <div className="rounded-2xl border border-borde bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-medium">
          Importando… {estado.hechas} de {estado.total}
        </p>
        <div className="mx-auto mt-3 h-2 max-w-sm overflow-hidden rounded-full bg-crema-deep">
          <div
            className="h-full rounded-full bg-celeste-deep transition-all"
            style={{
              width: `${Math.round((estado.hechas / Math.max(1, estado.total)) * 100)}%`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-piedra">No cierres esta pestaña.</p>
      </div>
    );
  }

  if (estado.paso === "listo") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold">Importación terminada</p>
          <p className="mt-1">
            {estado.creados} clientes nuevos creados
            {estado.salteados > 0 &&
              ` · ${estado.salteados} salteados (ya existían por teléfono/CUIT o no tenían nombre)`}
          </p>
        </div>
        {estado.errores.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">Filas con error:</p>
            {estado.errores.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Link
            href="/clientes"
            className="rounded-2xl bg-tinta px-4 py-2.5 text-sm font-medium text-white"
          >
            Ver clientes
          </Link>
          <button
            type="button"
            onClick={() => setEstado({ paso: "elegir" })}
            className="rounded-2xl border border-borde px-4 py-2.5 text-sm text-piedra"
          >
            Importar otro archivo
          </button>
        </div>
      </div>
    );
  }

  // paso "mapear"
  const { encabezados, filas, mapeo } = estado;
  const vista = filas.slice(0, 5);

  return (
    <div className="space-y-4">
      <p className="text-sm text-piedra">
        {filas.length} filas encontradas. Revisá que cada columna esté bien
        identificada (lo adiviné por los títulos; corregí lo que haga falta):
      </p>

      <div className="overflow-x-auto rounded-2xl border border-borde bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde bg-crema/60">
              {encabezados.map((h, i) => (
                <th key={i} className="min-w-40 px-3 py-2 text-left align-top">
                  <p className="text-xs font-semibold text-piedra">{h || `Columna ${i + 1}`}</p>
                  <select
                    value={mapeo[i]}
                    onChange={(e) => {
                      const nuevo = [...mapeo];
                      nuevo[i] = e.target.value;
                      setEstado({ ...estado, mapeo: nuevo });
                    }}
                    className={`mt-1 w-full rounded-lg border px-2 py-1 text-xs ${
                      mapeo[i] ? "border-celeste bg-celeste-soft/50" : "border-borde text-piedra"
                    }`}
                  >
                    {CAMPOS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vista.map((f, ri) => (
              <tr key={ri} className="border-b border-borde/60 last:border-0">
                {f.map((c, ci) => (
                  <td key={ci} className="px-3 py-1.5 text-xs text-tinta/80">
                    {c || <span className="text-piedra/50">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-piedra">
          Cargarlos como:{" "}
          <select
            value={estadoCliente}
            onChange={(e) =>
              setEstadoCliente(e.target.value as "cliente_activo" | "prospecto")
            }
            className="rounded-xl border border-borde bg-white px-2.5 py-1.5 text-sm text-tinta"
          >
            <option value="cliente_activo">Clientes activos (ya compraron)</option>
            <option value="prospecto">Prospectos (todavía no compraron)</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void importar()}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-tinta px-4 py-2.5 text-sm font-medium text-white"
        >
          <Upload className="h-4 w-4" /> Importar {filas.length} filas
        </button>
        <button
          type="button"
          onClick={() => setEstado({ paso: "elegir" })}
          className="rounded-2xl border border-borde px-4 py-2.5 text-sm text-piedra"
        >
          Elegir otro archivo
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-piedra">
        Los repetidos no se duplican: si el teléfono o el CUIT ya están en el
        CRM, esa fila se saltea.
      </p>
    </div>
  );
}
