import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveClubId } from "@/lib/club";

export default async function ClubsPage() {
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

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
        Seleccionar club
      </h1>

      {error && <p>Error: {error.message}</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {(data ?? []).map((r: any) => {
          const isActive = activeClubId === r.club_id;
          return (
            <div
              key={r.club_id}
              style={{
                border: "1px solid #ddd",
                padding: 12,
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>
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
                </div>

                <form action="/api/club/seleccionar" method="post">
                  <input type="hidden" name="club_id" value={r.club_id} />
                  <button
                    type="submit"
                    style={{ padding: "8px 12px", cursor: "pointer" }}
                  >
                    Usar este club
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
      <a href="/clubs/new" style={{ display: "inline-block", marginBottom: 12 }}>
        + Nuevo club
      </a>

      <p style={{ marginTop: 14, opacity: 0.8 }}>
        Nota: el club activo se guarda en una cookie para que funcione también en
        páginas server (SSR).
      </p>
    </div>
  );
}
