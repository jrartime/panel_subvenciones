import Link from "next/link";
import { getActiveClubId } from "@/lib/club";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getMyClubRole,
  canAccessConciliation,
  canManageMembers,
} from "@/lib/clubRole";

// =========================
// BLOQUE 1: Permisos de edición (módulos que modifican datos)
// =========================
function canEdit(role: string | null) {
  return role === "owner" || role === "admin" || role === "manager";
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // =========================
  // BLOQUE 2: Leer club activo desde cookie (SSR)
  // =========================
  const activeClubId = await getActiveClubId();

  // =========================
  // BLOQUE 3: Cargar nombre del club activo y rol del usuario en ese club
  // =========================
  let activeClubName: string | null = null;
  let myRole: string | null = null;

  if (activeClubId) {
    const supabase = await createSupabaseServerClient();

    // Nombre del club activo
    const { data: clubData } = await supabase
      .from("clubes")
      .select("nombre")
      .eq("id_club", activeClubId)
      .single();

    activeClubName = clubData?.nombre ?? null;

    // Rol del usuario en el club activo
    myRole = await getMyClubRole(activeClubId);
  }

  // =========================
  // BLOQUE 4: Flags de visibilidad del menú según permisos
  // =========================
  const showConciliacion = !!activeClubId && canAccessConciliation(myRole as any);
  const showEditModules = !!activeClubId && canEdit(myRole);
  const showMembers = !!activeClubId && canManageMembers(myRole as any);

  // Nóminas: mismo permiso que edición (owner/admin/manager)
  const showNominas = !!activeClubId && canEdit(myRole);

  // =========================
  // BLOQUE 5: Render del layout (sidebar + contenido)
  // =========================
  return (
    <html lang="es">
      <body>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          {/* =========================
              BLOQUE 5.1: Sidebar (info del club + navegación)
              ========================= */}
          <aside
            style={{
              width: 240,
              borderRight: "1px solid #ddd",
              padding: 16,
            }}
          >
            {/* =========================
                BLOQUE 5.1.1: Título del panel
                ========================= */}
            <div style={{ fontWeight: 900, marginBottom: 12 }}>
              Panel Subvenciones
            </div>

            {/* =========================
                BLOQUE 5.1.2: Estado del club activo + rol + enlace cambiar club
                ========================= */}
            <div style={{ marginBottom: 12, opacity: 0.85 }}>
              Club activo:{" "}
              <b>
                {activeClubId
                  ? `${activeClubId} - ${activeClubName ?? ""}`
                  : "-"}
              </b>

              {activeClubId && (
                <div style={{ marginTop: 6, opacity: 0.8 }}>
                  Tu rol: <b>{myRole ?? "-"}</b>
                </div>
              )}

              <div style={{ marginTop: 6 }}>
                <Link href="/clubs">Cambiar club</Link>
              </div>
            </div>

            {/* =========================
                BLOQUE 5.1.3: Menú lateral (links condicionados por permisos)
                ========================= */}
            <nav style={{ display: "grid", gap: 8 }}>
              <Link href="/">Inicio</Link>

              {showConciliacion && (
                <Link href="/conciliacion/1a1">Conciliación 1a1</Link>
              )}

              {showEditModules && (
                <>
                  <Link href="/proveedores">Proveedores</Link>
                  <Link href="/contabilidad">Contabilidad</Link>
                </>
              )}

              {/* Nóminas: visible para owner/admin/manager */}
              {showNominas && <Link href="/nominas">Nóminas</Link>}

              {showMembers && <Link href="/clubs/members">Miembros del club</Link>}
            </nav>
          </aside>

          {/* =========================
              BLOQUE 5.2: Contenido principal (páginas)
              ========================= */}
          <main style={{ flex: 1 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}

