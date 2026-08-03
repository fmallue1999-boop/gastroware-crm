# Formulario web → lead automático en el CRM

Pegando este bloque en zumex.com.ar (o gastroware.com.ar), cada consulta del
sitio crea sola en el CRM: el cliente (o lo encuentra si ya existe por el
teléfono), la oportunidad con origen "Web", una tarea "Responder consulta web"
que vence HOY, y una notificación para dirección/administración.

Anti-spam: campo trampa oculto (honeypot) + límite de 20 consultas por hora.
No requiere claves: el endpoint es público y solo puede crear leads.

## Código para pegar

```html
<form id="form-consulta" style="display:grid;gap:12px;max-width:420px">
  <input name="nombre" placeholder="Nombre o negocio *" required>
  <input name="telefono" type="tel" placeholder="WhatsApp / teléfono">
  <input name="email" type="email" placeholder="Email">
  <input name="ciudad" placeholder="Ciudad">
  <select name="producto">
    <option value="">¿Qué te interesa?</option>
    <option>Zumex</option>
    <option>GX22</option>
    <option>GX18</option>
    <option value="Pastillas">Pastillas de limpieza Rational</option>
    <option value="">Otro / no sé</option>
  </select>
  <textarea name="mensaje" placeholder="Contanos qué necesitás" rows="3"></textarea>
  <!-- Campo trampa anti-bots: NO borrar, queda invisible -->
  <input name="sitio_web" tabindex="-1" autocomplete="off"
         style="position:absolute;left:-9999px" aria-hidden="true">
  <button type="submit">Enviar consulta</button>
  <p id="form-consulta-msj" style="margin:0;font-size:14px"></p>
</form>
<script>
document.getElementById("form-consulta").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const msj = document.getElementById("form-consulta-msj");
  const boton = form.querySelector("button");
  boton.disabled = true;
  msj.textContent = "Enviando…";
  try {
    const r = await fetch("https://gastroware-crm.vercel.app/api/lead-web", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const data = await r.json();
    if (r.ok) {
      form.reset();
      msj.textContent = "¡Listo! Te contactamos a la brevedad.";
    } else {
      msj.textContent = data.error || "No se pudo enviar, probá de nuevo.";
      boton.disabled = false;
    }
  } catch {
    msj.textContent = "No se pudo enviar, probá de nuevo.";
    boton.disabled = false;
  }
});
</script>
```

Los estilos son mínimos a propósito: adaptalos al diseño del sitio.

## Probarlo sin tocar el sitio

```bash
curl -X POST https://gastroware-crm.vercel.app/api/lead-web -H "Content-Type: application/json" -d "{\"nombre\":\"Prueba formulario\",\"telefono\":\"1122334455\",\"mensaje\":\"probando\"}"
```

Después borrá el lead "Prueba formulario" desde el CRM.
