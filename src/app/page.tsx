import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveClubId } from "@/lib/club";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  const user = userData.user;
  if (!user) redirect("/login");
 
  const activeClubId = await getActiveClubId();

  const { data, error } = await supabase
    .from("club_miembros")
    .select("club_id, rol, clubes(id_club, nombre, nif, email)")
    .eq("user_id", user.id)
    .order("club_id", { ascending: true });

  const hasClubs = (data ?? []).length > 0;
  const hasActiveClub = !!activeClubId;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
        Mis clubes
      </h2>

      {error && <p>Error: {error.message}</p>}

      {/* Caso: no pertenece a ningún club */}
      {!error && !hasClubs && (
        <div style={{ border: "1px dashed #ccc", padding: 12, borderRadius: 8 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            No perteneces a ningún club todavía.
          </p>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Pide a un administrador que te añada desde “Miembros del club”.
          </p>
          <p style={{ marginTop: 10 }}>
            <a href="/clubs/new">Crear un club</a>
            {" · "}
            <a href="/clubs">Seleccionar club</a>
          </p>
        </div>
      )}

      {/* Lista de clubes */}
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {(data ?? []).map((r: any) => {
          const isActive = activeClubId === r.club_id;

          return (
            <div key={r.club_id} style={{ border: "1px solid #ddd", padding: 12 }}>
              <div style={{ fontWeight: 700 }}>
                {r.clubes?.nombre}{" "}
                {isActive && (
                  <span style={{ fontWeight: 600, opacity: 0.7 }}>
                    (activo)
                  </span>
                )}
              </div>

              <div style={{ opacity: 0.8 }}>
                id_club: {r.club_id} · rol: {r.rol}
              </div>

              <div style={{ opacity: 0.8 }}>
                nif: {r.clubes?.nif ?? "-"} · email: {r.clubes?.email ?? "-"}
              </div>

              <form
                action="/api/club/seleccionar"
                method="post"
                style={{ marginTop: 10 }}
              >
                <input type="hidden" name="club_id" value={r.club_id} />
                <button
                  type="submit"
                  style={{ padding: "6px 10px", cursor: "pointer" }}
                >
                  {isActive ? "Club activo" : "Activar este club"}
                </button>
              </form>
            </div>
          );
        })}
      </div>

      {/* Accesos: solo si hay club activo */}
      <div style={{ marginTop: 16 }}>
       {!hasActiveClub ? (
      <p style={{ marginTop: 16 }}>
       Para acceder a conciliación, primero selecciona un club activo:{" "}
       <a href="/clubs">Cambiar/seleccionar club</a>
     </p>
   ) : (
    <>
      <p style={{ marginTop: 16 }}>
        <a href="/conciliacion/1a1">Ir a Conciliación 1a1</a>
      </p>

      <p style={{ marginTop: 12 }}>
        <a href="/proveedores">Proveedores</a>
        {" · "}
        <a href="/contabilidad">Contabilidad</a>
      </p>
    </>
  )}
</div>

    </div>
  );
}
