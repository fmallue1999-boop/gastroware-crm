import CambiarPasswordForm from "@/components/CambiarPasswordForm";

export default function PasswordPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold tracking-tight mb-1">
        Cambiar contraseña
      </h1>
      <p className="text-sm text-piedra mb-5">
        Si entraste con una contraseña inicial que te pasaron, cambiala acá por
        una tuya.
      </p>
      <CambiarPasswordForm />
    </div>
  );
}
