import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole } from "@/lib/clubRole";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function canEdit(role: string | null) {
  return role === "owner" || role === "admin" || role === "manager";
}

function toNullableBigint(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toDateInputValue(v: any): string {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return "";
}

function toSelectValue(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v);
}

async function upsertAsiento(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = String(formData.get("id_contabilidad") ?? "").trim();

  const tipo_id = toNullableBigint(formData.get("tipo_id"));
  const proveedor_id = toNullableBigint(formData.get("proveedor_id"));
  const concepto_id = toNullableBigint(formData.get("concepto_id"));
  const entidad_id = toNullableBigint(formData.get("entidad_id"));
  const programa_id = toNullableBigint(formData.get("programa_id"));
  const categoria_id = toNullableBigint(formData.get("categoria_id"));

  const numero_factura =
    String(formData.get("numero_factura") ?? "").trim() || null;
  const fecha = String(formData.get("fecha") ?? "").trim() || null; // YYYY-MM-DD
  const fecha_pago = String(formData.get("fecha_pago") ?? "").trim() || null;

  const importe_total = Number(formData.get("importe_total"));
  const importe_imputado = Number(formData.get("importe_imputado"));
  const detalle = String(formData.get("detalle") ?? "").trim() || null;

  if (!clubId || !Number.isFinite(clubId))
    redirect("/contabilidad?error=club_id%20inv%C3%A1lido");
  if (!Number.isFinite(importe_total))
    redirect("/contabilidad?error=importe_total%20inv%C3%A1lido");
  if (!Number.isFinite(importe_imputado))
    redirect("/contabilidad?error=importe_imputado%20inv%C3%A1lido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEdit(myRole)) redirect("/no-autorizado");

  const payload: any = {
    club_id: clubId,
    tipo_id,
    proveedor_id,
    concepto_id,
    entidad_id,
    programa_id,
    categoria_id,
    numero_factura,
    fecha: fecha || null,
    fecha_pago: fecha_pago || null,
    importe_total,
    importe_imputado,
    detalle,
  };

  const { error } = id
    ? await supabase
        .from("contabilidad")
        .update(payload)
        .eq("club_id", clubId)
        .eq("id_contabilidad", Number(id))
    : await supabase.from("contabilidad").insert(payload);

  if (error)
    redirect("/contabilidad?error=" + encodeURIComponent(error.message));
  redirect("/contabilidad");
}

async function deleteAsiento(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = Number(formData.get("id_contabilidad"));

  if (!clubId || !Number.isFinite(clubId))
    redirect("/contabilidad?error=club_id%20inv%C3%A1lido");
  if (!id || !Number.isFinite(id))
    redirect("/contabilidad?error=id_contabilidad%20inv%C3%A1lido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEdit(myRole)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("contabilidad")
    .delete()
    .eq("club_id", clubId)
    .eq("id_contabilidad", id);

  if (error)
    redirect("/contabilidad?error=" + encodeURIComponent(error.message));
  redirect("/contabilidad");
}

export default async function ContabilidadPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; edit?: string; programa_id?: string }>;
}) {
  const sp = (await searchParams) ?? {};

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  const canUserEdit = canEdit(myRole);

  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const editId = sp.edit ? Number(sp.edit) : null;
  const programaFilterId = sp.programa_id ? Number(sp.programa_id) : null;
  const hasProgramaFilter = !!programaFilterId && Number.isFinite(programaFilterId);


    // Tipos (Factura, Nómina, etc.)
  const { data: tipos } = await supabase
  .from("tipos")
  .select("id_tipo, tipo")
  .eq("club_id", clubId)
  .order("id_tipo", { ascending: true });

  // Proveedores (del club)
  const { data: proveedores } = await supabase
    .from("proveedores")
    .select("id_proveedor, proveedor")
    .eq("club_id", clubId)
    .order("proveedor", { ascending: true });

  // Conceptos / Entidades / Programas (globales)
  const { data: conceptos } = await supabase
    .from("conceptos")
    .select("id_concepto, concepto")
    .order("concepto", { ascending: true });

  const { data: entidades } = await supabase
    .from("entidades")
    .select("id_entidad, entidad")
    .order("entidad", { ascending: true });

  const { data: programas } = await supabase
    .from("programas")
    .select("id_programa, programa")
    .order("programa", { ascending: true });

  // Categorías (A, B, C)
  const { data: categorias } = await supabase
    .from("categorias")
    .select("id_categoria, categoria")
    .order("id_categoria", { ascending: true });

  // Contabilidad + joins (proveedor, programa, categoria, concepto)
  let q = supabase
    .from("contabilidad")
    .select(
      [
        "id_contabilidad",
        "tipo_id",
        "proveedor_id",
        "concepto_id",
        "entidad_id",
        "programa_id",
        "categoria_id",
        "numero_factura",
        "fecha",
        "fecha_pago",
        "importe_total",
        "importe_imputado",
        "detalle",
        "created_at",
        // joins
        "proveedor:proveedores!contabilidad_proveedor_fk (id_proveedor, proveedor)",
        "programa_ref:programas!contabilidad_programa_id_fkey (id_programa, programa)",
        "categoria_ref:categorias!contabilidad_categoria_id_fkey (id_categoria, categoria)",
        "concepto_ref:conceptos!contabilidad_concepto_id_fkey (id_concepto, concepto)",
      ].join(",")
    )
    .eq("club_id", clubId);

  if (hasProgramaFilter) {
    q = q.eq("programa_id", programaFilterId);
  }

  const { data: rows, error } = await q
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(2000);
const safeRows = rows ?? [];

type Tot = { total: number; imputado: number; count: number };

const totales = (rows ?? []).reduce(
  (acc, r: any) => {
    const total = Number(r.importe_total ?? 0) || 0;
    const imputado = Number(r.importe_imputado ?? 0) || 0;
    const cat = String(r.categoria_ref?.categoria ?? "").toUpperCase();

    // Global
    acc.global.total += total;
    acc.global.imputado += imputado;
    acc.global.count += 1;

    if (cat === "A") {
      acc.A.total += total;
      acc.A.imputado += imputado;
      acc.A.count += 1;
    } else if (cat === "B") {
      acc.B.total += total;
      acc.B.imputado += imputado;
      acc.B.count += 1;
    } else {
      acc.otras.total += total;
      acc.otras.imputado += imputado;
      acc.otras.count += 1;
    }

    return acc;
  },
  {
    global: { total: 0, imputado: 0, count: 0 } as Tot,
    A: { total: 0, imputado: 0, count: 0 } as Tot,
    B: { total: 0, imputado: 0, count: 0 } as Tot,
    otras: { total: 0, imputado: 0, count: 0 } as Tot,
  }
);


  // Evitar inferencias raras de TS: trabajamos como any
  const rowsAny = (rows ?? []) as any[];

  let editRow: any =
    editId !== null
      ? rowsAny.find((r) => Number(r.id_contabilidad) === Number(editId))
      : null;

  // Fallback: si el asiento a editar no está en rows, lo cargamos por id
  if (editId && !editRow) {
    const { data: one } = await supabase
      .from("contabilidad")
      .select(
        [
          "id_contabilidad",
          "proveedor_id",
          "concepto_id",
          "entidad_id",
          "programa_id",
          "categoria_id",
          "numero_factura",
          "fecha",
          "fecha_pago",
          "importe_total",
          "importe_imputado",
          "detalle",
          "created_at",
          "proveedor:proveedores!contabilidad_proveedor_fk (id_proveedor, proveedor)",
          "categoria_ref:categorias!contabilidad_categoria_id_fkey (id_categoria, categoria)",
        ].join(",")
      )
      .eq("club_id", clubId)
      .eq("id_contabilidad", editId)
      .maybeSingle();

    editRow = (one as any) ?? null;
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Contabilidad</h1>
        <a href="/" style={{ marginLeft: "auto" }}>
          ← Volver
        </a>
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
          {editRow
            ? `Editar asiento (id ${editRow.id_contabilidad})`
            : "Nuevo asiento"}
        </h2>

        {!canUserEdit ? (
          <p style={{ margin: 0, opacity: 0.8 }}>
            No tienes permisos para crear/editar asientos.
          </p>
        ) : (
          <form 
          key={editRow ? `edit-${editRow.id_contabilidad}` : "new"}
            action={upsertAsiento} 
            style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="club_id" value={clubId} />
            <input
              type="hidden"
              name="id_contabilidad"
              value={editRow?.id_contabilidad ?? ""}
            />

            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "0.8fr 1.2fr 0.8fr",
              }}
            >
              {/* Tipo */}
              <label>
                Tipo
                <select
                  name="tipo_id"
                  defaultValue={toSelectValue(editRow?.tipo_id)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">(sin tipo)</option>
                  {(tipos ?? []).map((t: any) => (
                    <option key={t.id_tipo} value={t.id_tipo}>
                      {t.tipo}
                    </option>
                  ))}
                </select>
              </label>

              {/* Proveedor */}
              <label>
                Proveedor
                <select
                  name="proveedor_id"
                  defaultValue={toSelectValue(editRow?.proveedor_id)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">(sin proveedor)</option>
                  {(proveedores ?? []).map((p: any) => (
                    <option key={p.id_proveedor} value={p.id_proveedor}>
                      {p.proveedor}
                    </option>
                  ))}
                </select>
              </label>

              {/* Nº factura */}
              <label>
                Nº factura
                <input
                  name="numero_factura"
                  defaultValue={editRow?.numero_factura ?? ""}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "1fr 1fr 1fr",
              }}
            >
              <label>
                Fecha (devengo)
                <input
                  name="fecha"
                  type="date"
                  defaultValue={toDateInputValue(editRow?.fecha)}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>

              <label>
                Fecha pago
                <input
                    name="fecha_pago"
                    type="date"
                    key={editRow ? `edit-${editRow.id_contabilidad}-fecha_pago` : "new-fecha_pago"}
                defaultValue={toDateInputValue(editRow?.fecha_pago)}
                style={{ width: "100%", padding: 8 }}
                />
              </label>

              <label>
                Categoría (A/B/C)
                <select
                  name="categoria_id"
                  defaultValue={toSelectValue(editRow?.categoria_id)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">(sin categoría)</option>
                  {(categorias ?? []).map((c: any) => (
                    <option key={c.id_categoria} value={c.id_categoria}>
                      {c.categoria}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "1fr 1fr 1fr",
              }}
            >
              <label>
                Concepto
                <select
                  name="concepto_id"
                  defaultValue={toSelectValue(editRow?.concepto_id)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">(sin concepto)</option>
                  {(conceptos ?? []).map((c: any) => (
                    <option key={c.id_concepto} value={c.id_concepto}>
                      {c.concepto}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Entidad
                <select
                  name="entidad_id"
                  defaultValue={toSelectValue(editRow?.entidad_id)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">(sin entidad)</option>
                  {(entidades ?? []).map((e: any) => (
                    <option key={e.id_entidad} value={e.id_entidad}>
                      {e.entidad}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Programa
                <select
                  name="programa_id"
                  defaultValue={toSelectValue(editRow?.programa_id)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">(sin programa)</option>
                  {(programas ?? []).map((p: any) => (
                    <option key={p.id_programa} value={p.id_programa}>
                      {p.programa}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <label>
                Importe total
                <input
                  name="importe_total"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={editRow?.importe_total ?? 0}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>

              <label>
                Importe imputado
                <input
                  name="importe_imputado"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={editRow?.importe_imputado ?? 0}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
            </div>

            <label>
              Detalle
              <input
                name="detalle"
                defaultValue={editRow?.detalle ?? ""}
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="submit"
                style={{ padding: "10px 12px", cursor: "pointer" }}
              >
                {editRow ? "Guardar cambios" : "Crear asiento"}
              </button>
              {editRow && (
                <a href="/contabilidad" style={{ opacity: 0.8 }}>
                  Cancelar edición
                </a>
              )}
            </div>
          </form>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginTop: 10 }}>
        <form method="get" action="/contabilidad" style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          {/* mantenemos edit si existiera, aunque normalmente no filtras mientras editas */}
          {editId ? <input type="hidden" name="edit" value={String(editId)} /> : null}

          <label>
            Filtrar por programa
            <select
              name="programa_id"
              defaultValue={hasProgramaFilter ? String(programaFilterId) : ""}
              style={{ display: "block", padding: 8, minWidth: 260 }}
            >
              <option value="">(todos)</option>
              {(programas ?? []).map((p: any) => (
                <option key={p.id_programa} value={p.id_programa}>
                  {p.programa}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" style={{ padding: "10px 12px", cursor: "pointer" }}>
            Aplicar filtro
          </button>

          <Link href="/contabilidad" style={{ padding: "10px 12px", opacity: 0.8 }}>
            Quitar filtro
          </Link>
        </form>
      </div>

      {/* Listado */}
      <h2 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>
        Registros de contabilidad {(hasProgramaFilter ? `(programa_id: ${programaFilterId})` : "")} ({(rows ?? []).length})
      </h2>

  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: 10,
      padding: 12,
      marginTop: 10,
      display: "grid",
      gap: 10,
    }}
  >
    <div style={{ fontWeight: 800 }}>
      Totales {hasProgramaFilter ? `del programa seleccionado` : "(todos los programas)"}
    </div>

    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4, 1fr)" }}>
      {/* GLOBAL */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
        <div style={{ fontWeight: 700 }}>Global ({totales.global.count})</div>
        <div>Total: <b>{totales.global.total.toFixed(2)}</b></div>
        <div>Imputado: <b>{totales.global.imputado.toFixed(2)}</b></div>
      </div>

      {/* A */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
        <div style={{ fontWeight: 700 }}>Categoría A ({totales.A.count})</div>
        <div>Total: <b>{totales.A.total.toFixed(2)}</b></div>
        <div>Imputado: <b>{totales.A.imputado.toFixed(2)}</b></div>
      </div>

      {/* B */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
        <div style={{ fontWeight: 700 }}>Categoría B ({totales.B.count})</div>
        <div>Total: <b>{totales.B.total.toFixed(2)}</b></div>
        <div>Imputado: <b>{totales.B.imputado.toFixed(2)}</b></div>
      </div>

      {/* OTRAS */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
        <div style={{ fontWeight: 700 }}>Sin categoría / otras ({totales.otras.count})</div>
        <div>Total: <b>{totales.otras.total.toFixed(2)}</b></div>
        <div>Imputado: <b>{totales.otras.imputado.toFixed(2)}</b></div>
      </div>
    </div>
  </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {[
                "Fecha",
                "Tipo",
                "Proveedor",
                "Categoría",
                "Nº factura",
                "Concepto",
                "Total",
                "Imputado",
                "Pago",
                "Acciones",
              ].map((h) => (
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
              <tr key={r.id_contabilidad}>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #eee",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.fecha ?? "-"}
                </td>
                
                <td 
                style={{ 
                  padding: 8, 
                  borderBottom: "1px solid #eee" 
                  }}
                >
                 {r.tipo_ref?.tipo ?? "-"}
                </td>


                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {r.proveedor?.proveedor ??
                    (r.proveedor_id ? `id ${r.proveedor_id}` : "-")}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {r.categoria_ref?.categoria ?? "-"}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {r.numero_factura ?? "-"}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {r.concepto_ref?.concepto ?? (r.concepto_id ? `id ${r.concepto_id}` : "-")}
                </td>


                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {Number(r.importe_total).toFixed(2)}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {Number(r.importe_imputado).toFixed(2)}
                </td>

                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #eee",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.fecha_pago ?? "-"}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {canUserEdit ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Link href={`/contabilidad?edit=${r.id_contabilidad}#form`}>
                        Editar
                      </Link>

                      <form action={deleteAsiento}>
                        <input type="hidden" name="club_id" value={clubId} />
                        <input
                          type="hidden"
                          name="id_contabilidad"
                          value={r.id_contabilidad}
                        />
                        <ConfirmSubmitButton message="¿Seguro que quieres eliminar este asiento?">
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
                <td colSpan={9} style={{ padding: 12, opacity: 0.8 }}>
                  No hay asientos en el último año (por fecha o created_at).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
