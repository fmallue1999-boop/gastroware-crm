import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminTabs from "@/components/admin/AdminTabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("fn_rol");
  if (!["direccion", "admin"].includes(rol ?? "")) redirect("/hoy");

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Administración</h1>
      <AdminTabs />
      <div className="mt-4">{children}</div>
    </div>
  );
}
