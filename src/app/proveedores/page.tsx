import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole } from "@/lib/clubRole";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function canEdit(role: string | null) {
  return role === "owner" || role === "admin" || role === "manager";
}

function toText(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

async function upsertProveedor(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = String(formData.get("id_proveedor") ?? "").trim();

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/proveedores?error=club_id%20inv%C3%A1lido");
  }

  const proveedor = String(formData.get("proveedor") ?? "").trim();
  if (!proveedor) redirect("/proveedores?error=Proveedor%20obligatorio");

  const payload: any = {
    club_id: clubId,
    proveedor,
    cif: toText(formData.get("cif")),
    domicilio: toText(formData.get("domicilio")),
    telefono: toText(formData.get("telefono")),
    email: toText(formData.get("email")),
    contacto: toText(formData.get("contacto")),
  };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEdit(myRole)) redirect("/no-autorizado");

  const { error } = id
    ? await supabase
        .from("proveedores")
        .update(payload)
        .eq("club_id", clubId)
        .eq("id_proveedor", Number(id))
    : await supabase.from("proveedores").insert(payload);

  if (error) redirect("/proveedores?error=" + encodeURIComponent(error.message));
  redirect("/proveedores");
}

async function deleteProveedor(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = Number(formData.get("id_proveedor"));

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/proveedores?error=club_id%20inv%C3%A1lido");
  }
  if (!id || !Number.isFinite(id)) {
    redirect("/proveedores?error=id_proveedor%20inv%C3%A1lido");
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEdit(myRole)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("proveedores")
    .delete()
    .eq("club_id", clubId)
    .eq("id_proveedor", id);

  if (error) redirect("/proveedores?error=" + encodeURIComponent(error.message));
  redirect("/proveedores");
}

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; edit?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const editId = sp.edit ? Number(sp.edit) : null;

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  const canUserEdit = canEdit(myRole);

  const { data: rows, error } = await supabase
    .from("proveedores")
    .select("id_proveedor, proveedor, cif, domicilio, telefono, email, contacto, created_at")
    .eq("club_id", clubId)
    .order("proveedor", { ascending: true })
    .limit(1000);

  const rowsAny = (rows ?? []) as any[];
  let editRow: any =
    editId !== null ? rowsAny.find((r) => Number(r.id_proveedor) === editId) : null;

  // Fallback por si editas algo que no está en la lista (raro, pero robusto)
  if (editId && !editRow) {
    const { data: one } = await supabase
      .from("proveedores")
      .select("id_proveedor, proveedor, cif, domicilio, telefono, email, contacto, created_at")
      .eq("club_id", clubId)
      .eq("id_proveedor", editId)
      .maybeSingle();
    editRow = (one as any) ?? null;
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Proveedores</h1>
        <Link href="/" style={{ marginLeft: "auto" }}>
          ← Volver
        </Link>
      </div>

      <p style={{ marginTop: 6, opacity: 0.75 }}>
        club_id: <b>{clubId}</b> · tu rol: <b>{myRole}</b>
      </p>

      {errorMsg && (
        <div
          style={{
            border: "1px solid #f5c2c2",
            background: "#fff5f5",
            padding: 10,
            borderRadius: 8,
          }}
        >
          <b>Error:</b> {errorMsg}
        </div>
      )}

      {error && <p>Error: {error.message}</p>}

      {/* Formulario */}
      <div
        id="form"
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 12,
          marginTop: 12,
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 10, fontSize: 16 }}>
          {editRow ? `Editar proveedor (id ${editRow.id_proveedor})` : "Nuevo proveedor"}
        </h2>

        {!canUserEdit ? (
          <p style={{ margin: 0, opacity: 0.8 }}>
            No tienes permisos para crear/editar proveedores.
          </p>
        ) : (
          <form
            key={editRow ? `edit-${editRow.id_proveedor}` : "new"} // ✅ clave para que defaultValue se aplique al editar
            action={upsertProveedor}
            style={{ display: "grid", gap: 10 }}
          >
            <input type="hidden" name="club_id" value={clubId} />
            <input type="hidden" name="id_proveedor" value={editRow?.id_proveedor ?? ""} />

            <label>
              Proveedor (nombre)
              <input
                name="proveedor"
                required
                defaultValue={editRow?.proveedor ?? ""}
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <label>
                CIF
                <input name="cif" defaultValue={editRow?.cif ?? ""} style={{ width: "100%", padding: 8 }} />
              </label>
              <label>
                Contacto
                <input
                  name="contacto"
                  defaultValue={editRow?.contacto ?? ""}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
            </div>

            <label>
              Domicilio
              <input
                name="domicilio"
                defaultValue={editRow?.domicilio ?? ""}
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label>
                Teléfono
                <input
                  name="telefono"
                  defaultValue={editRow?.telefono ?? ""}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={editRow?.email ?? ""}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
              <div />
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button type="submit" style={{ padding: "10px 12px", cursor: "pointer" }}>
                {editRow ? "Guardar cambios" : "Crear proveedor"}
              </button>

              {editRow && (
                <Link href="/proveedores" style={{ opacity: 0.8 }}>
                  Cancelar edición
                </Link>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Listado */}
      <h2 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>
        Listado ({rowsAny.length})
      </h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Proveedor", "CIF", "Contacto", "Teléfono", "Email", "Acciones"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 8,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rowsAny.map((r: any) => (
              <tr key={r.id_proveedor}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  <div style={{ fontWeight: 700 }}>{r.proveedor}</div>
                  <div style={{ opacity: 0.65, fontSize: 12 }}>id: {r.id_proveedor}</div>
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{r.cif ?? "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{r.contacto ?? "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{r.telefono ?? "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{r.email ?? "-"}</td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {canUserEdit ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Link href={`/proveedores?edit=${r.id_proveedor}#form`}>Editar</Link>

                      <form action={deleteProveedor}>
                        <input type="hidden" name="club_id" value={clubId} />
                        <input type="hidden" name="id_proveedor" value={r.id_proveedor} />

                        <ConfirmSubmitButton message="¿Seguro que quieres eliminar este proveedor? Si está usado en contabilidad, puede dar error.">
                          Eliminar
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  ) : (
                    <span style={{ opacity: 0.6 }}>—</span>
                  )}
                </td>
              </tr>
            ))}

            {rowsAny.length === 0 && !error && (
              <tr>
                <td colSpan={6} style={{ padding: 12, opacity: 0.8 }}>
                  No hay proveedores todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
