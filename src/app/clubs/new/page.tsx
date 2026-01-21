import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function createClub(formData: FormData) {
  "use server";

  const nombre = String(formData.get("nombre") ?? "").trim();
  const nif = String(formData.get("nif") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;

  if (!nombre) throw new Error("El nombre es obligatorio");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { error } = await supabase.rpc("crear_club_y_owner", {
    p_nombre: nombre,
    p_nif: nif,
    p_direccion: direccion,
    p_email: email,
    p_telefono: telefono,
  });

  if (error) throw new Error(error.message);

  redirect("/clubs");
}

export default async function NewClubPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
        Alta de club
      </h1>

      <form action={createClub} style={{ display: "grid", gap: 10 }}>
        <label>
          Nombre *
          <input name="nombre" required style={{ width: "100%", padding: 8 }} />
        </label>

        <label>
          NIF
          <input name="nif" style={{ width: "100%", padding: 8 }} />
        </label>

        <label>
          Dirección
          <input name="direccion" style={{ width: "100%", padding: 8 }} />
        </label>

        <label>
          Email
          <input name="email" type="email" style={{ width: "100%", padding: 8 }} />
        </label>

        <label>
          Teléfono
          <input name="telefono" style={{ width: "100%", padding: 8 }} />
        </label>

        <button type="submit" style={{ padding: "10px 12px", cursor: "pointer" }}>
          Crear club
        </button>
      </form>
    </div>
  );
}

