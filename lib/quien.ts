import { cookies } from "next/headers";

const esUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/**
 * De quién se ven el embudo y los pendientes: los vendedores ven los suyos;
 * dirección y administración lo que eligieron (Míos / De todos / un vendedor),
 * guardado en la cookie `pendientes_quien`.
 */
export async function filtroQuien(userId: string, esGestor: boolean) {
  const cookieStore = await cookies();
  const preferencia = cookieStore.get("pendientes_quien")?.value ?? "";
  const quien = esGestor ? preferencia || "todos" : "mios";
  const comercialId = quien === "mios" ? userId : esUuid(quien) ? quien : null;
  return { quien, comercialId };
}
