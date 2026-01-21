import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole } from "@/lib/clubRole";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NOMINA_TIPO_ID = 3;

function canEdit(role: string | null) {
  return role === "owner" || role === "admin" || role === "manager";
}

function toNullableBigint(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toNullableText(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function toNullableNumber(v: FormDataEntryValue | null): number | null {
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

async function upsertNomina(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = String(formData.get("id_contabilidad") ?? "").trim();

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/nominas?error=club_id%20inv%C3%A1lido");
  }

  const proveedor_id = toNullableBigint(formData.get("proveedor_id"));
  const concepto_id = toNullableBigint(formData.get("concepto_id"));
  const entidad_id = toNullableBigint(formData.get("entidad_id"));
  const programa_id = toNullableBigint(formData.get("programa_id"));
  const categoria_id = toNullableBigint(formData.get("categoria_id"));

  const personal = toNullableText(formData.get("personal"));
  const fecha = toNullableText(formData.get("fecha")); // YYYY-MM-DD
  const fecha_pago = toNullableText(formData.get("fecha_pago")); // YYYY-MM-DD

  // Campos nómina (numéricos)
  const bruto = toNullableNumber(formData.get("bruto"));
  const bruto_imputado = toNullableNumber(formData.get("bruto_imputado"));
  const coste_empresarial = toNullableNumber(formData.get("coste_empresarial"));
  const ss = toNullableNumber(formData.get("ss"));
  const ss_imputado = toNullableNumber(formData.get("ss_imputado"));

  // Totales (obligatorios en tu tabla; default 0 en DB, pero aquí validamos)
  const importe_total = Number(formData.get("importe_total"));
  const importe_imputado = Number(formData.get("importe_imputado"));

  const detalle = toNullableText(formData.get("detalle"));

  if (!Number.isFinite(importe_total)) {
    redirect("/nominas?error=importe_total%20inv%C3%A1lido");
  }
  if (!Number.isFinite(importe_imputado)) {
    redirect("/nominas?error=importe_imputado%20inv%C3%A1lido");
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEdit(myRole)) redirect("/no-autorizado");

  // OJO: forzamos tipo_id = 3 siempre
  const payload: any = {
    club_id: clubId,
    tipo_id: NOMINA_TIPO_ID,

    proveedor_id,
    concepto_id,
    entidad_id,
    programa_id,
    categoria_id,

    personal,
    fecha,
    fecha_pago,

    bruto,
    bruto_imputado,
    coste_empresarial,
    ss,
    ss_imputado,

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
        .eq("tipo_id", NOMINA_TIPO_ID)
    : await supabase.from("contabilidad").insert(payload);

  if (error) redirect("/nominas?error=" + encodeURIComponent(error.message));
  redirect("/nominas");
}

async function deleteNomina(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = Number(formData.get("id_contabilidad"));

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/nominas?error=club_id%20inv%C3%A1lido");
  }
  if (!id || !Number.isFinite(id)) {
    redirect("/nominas?error=id_contabilidad%20inv%C3%A1lido");
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEdit(myRole)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("contabilidad")
    .delete()
    .eq("club_id", clubId)
    .eq("id_contabilidad", id)
    .eq("tipo_id", NOMINA_TIPO_ID);

  if (error) redirect("/nominas?error=" + encodeURIComponent(error.message));
  redirect("/nominas");
}

export default async function NominasPage({
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

  const { data: categorias } = await supabase
    .from("categorias")
    .select("id_categoria, categoria")
    .order("id_categoria", { ascending: true });

  // Nóminas (contabilidad tipo_id=3) + joins
  let q = supabase
    .from("contabilidad")
    .select(
      [
        "id_contabilidad",
        "tipo_id",
        "personal",
        "bruto",
        "bruto_imputado",
        "coste_empresarial",
        "ss",
        "ss_imputado",
        "proveedor_id",
        "fecha",
        "fecha_pago",
        "importe_total",
        "importe_imputado",
        "concepto_id",
        "entidad_id",
        "programa_id",
        "categoria_id",
        "detalle",
        "created_at",
        // joins
        "proveedor:proveedores!contabilidad_proveedor_fk (id_proveedor, proveedor)",
        "programa_ref:programas!contabilidad_programa_id_fkey (id_programa, programa)",
        "categoria_ref:categorias!contabilidad_categoria_id_fkey (id_categoria, categoria)",
        "concepto_ref:conceptos!contabilidad_concepto_id_fkey (id_concepto, concepto)",
        "entidad_ref:entidades!contabilidad_entidad_id_fkey (id_entidad, entidad)",
      ].join(",")
    )
    .eq("club_id", clubId)
    .eq("tipo_id", NOMINA_TIPO_ID);

  if (hasProgramaFilter) {
    q = q.eq("programa_id", programaFilterId);
  }

  const { data: rows, error } = await q
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(5000);

  const rowsAny = (rows ?? []) as any[];

  // Totales por categoría (A/B/otras) como contabilidad
  type Tot = { total: number; imputado: number; count: number };
  const totales = rowsAny.reduce(
    (acc, r: any) => {
      const total = Number(r.importe_total ?? 0) || 0;
      const imputado = Number(r.importe_imputado ?? 0) || 0;
      const cat = String(r.categoria_ref?.categoria ?? "").toUpperCase();

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

  // Edit row
  let editRow: any =
    editId !== null ? rowsAny.find((r) => Number(r.id_contabilidad) === Number(editId)) : null;

  // Fallback: si no está (por ejemplo si limitaste) lo cargamos por id
  if (editId && !editRow) {
    const { data: one } = await supabase
      .from("contabilidad")
      .select(
        [
          "id_contabilidad",
          "tipo_id",
          "personal",
          "bruto",
          "bruto_imputado",
          "coste_empresarial",
          "ss",
          "ss_imputado",
          "proveedor_id",
          "fecha",
          "fecha_pago",
          "importe_total",
          "importe_imputado",
          "concepto_id",
          "entidad_id",
          "programa_id",
          "categoria_id",
          "detalle",
          "created_at",
        ].join(",")
      )
      .eq("club_id", clubId)
      .eq("tipo_id", NOMINA_TIPO_ID)
      .eq("id_contabilidad", editId)
      .maybeSingle();

    editRow = (one as any) ?? null;
  }

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Nóminas</h1>
        <a href="/" style={{ marginLeft: "auto" }}>
          ← Volver
        </a>
      </div>

      <p style={{ marginTop: 6, opacity: 0.75 }}>
        club_id: <b>{clubId}</b> · tipo_id: <b>{NOMINA_TIPO_ID}</b> · tu rol: <b>{myRole}</b>
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
          {editRow ? `Editar nómina (id ${editRow.id_contabilidad})` : "Nueva nómina"}
        </h2>

        {!canUserEdit ? (
          <p style={{ margin: 0, opacity: 0.8 }}>No tienes permisos para crear/editar nóminas.</p>
        ) : (
          <form
            key={editRow ? `edit-${editRow.id_contabilidad}` : "new"}
            action={upsertNomina}
            style={{ display: "grid", gap: 10 }}
          >
            <input type="hidden" name="club_id" value={clubId} />
            <input type="hidden" name="id_contabilidad" value={editRow?.id_contabilidad ?? ""} />

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label>
                Personal
                <input
                  name="personal"
                  defaultValue={editRow?.personal ?? ""}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>

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
                  defaultValue={toDateInputValue(editRow?.fecha_pago)}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
              <label>
                Bruto
                <input
                  name="bruto"
                  type="number"
                  step="0.01"
                  defaultValue={editRow?.bruto ?? ""}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>

              <label>
                Bruto imputado
                <input
                  name="bruto_imputado"
                  type="number"
                  step="0.01"
                  defaultValue={editRow?.bruto_imputado ?? ""}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>

              <label>
                Coste empresarial
                <input
                  name="coste_empresarial"
                  type="number"
                  step="0.01"
                  defaultValue={editRow?.coste_empresarial ?? ""}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>

              <label>
                SS
                <input
                  name="ss"
                  type="number"
                  step="0.01"
                  defaultValue={editRow?.ss ?? ""}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>

              <label>
                SS imputado
                <input
                  name="ss_imputado"
                  type="number"
                  step="0.01"
                  defaultValue={editRow?.ss_imputado ?? ""}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1.2fr 1fr 1fr" }}>
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

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
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
                Detalle
                <input
                  name="detalle"
                  defaultValue={editRow?.detalle ?? ""}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
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

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button type="submit" style={{ padding: "10px 12px", cursor: "pointer" }}>
                {editRow ? "Guardar cambios" : "Crear nómina"}
              </button>
              {editRow && (
                <a href="/nominas" style={{ opacity: 0.8 }}>
                  Cancelar edición
                </a>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Filtro por programa */}
      <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginTop: 10 }}>
        <form method="get" action="/nominas" style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
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

          <Link href="/nominas" style={{ padding: "10px 12px", opacity: 0.8 }}>
            Quitar filtro
          </Link>
        </form>
      </div>

      {/* Totales */}
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
          Totales {hasProgramaFilter ? "del programa seleccionado" : "(todos los programas)"}
        </div>

        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ fontWeight: 700 }}>Global ({totales.global.count})</div>
            <div>Total: <b>{totales.global.total.toFixed(2)}</b></div>
            <div>Imputado: <b>{totales.global.imputado.toFixed(2)}</b></div>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ fontWeight: 700 }}>Categoría A ({totales.A.count})</div>
            <div>Total: <b>{totales.A.total.toFixed(2)}</b></div>
            <div>Imputado: <b>{totales.A.imputado.toFixed(2)}</b></div>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ fontWeight: 700 }}>Categoría B ({totales.B.count})</div>
            <div>Total: <b>{totales.B.total.toFixed(2)}</b></div>
            <div>Imputado: <b>{totales.B.imputado.toFixed(2)}</b></div>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ fontWeight: 700 }}>Sin categoría / otras ({totales.otras.count})</div>
            <div>Total: <b>{totales.otras.total.toFixed(2)}</b></div>
            <div>Imputado: <b>{totales.otras.imputado.toFixed(2)}</b></div>
          </div>
        </div>
      </div>

      {/* Listado */}
      <h2 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>
        Registros de nóminas {hasProgramaFilter ? `(programa_id: ${programaFilterId})` : ""} ({rowsAny.length})
      </h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {[
                "Fecha",
                "Personal",
                "Proveedor",
                "Programa",
                "Categoría",
                "Concepto",
                "Bruto",
                "SS",
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
                <td style={{ padding: 8, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                  {r.fecha ?? "-"}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {r.personal ?? "-"}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {r.proveedor?.proveedor ?? (r.proveedor_id ? `id ${r.proveedor_id}` : "-")}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {r.programa_ref?.programa ?? (r.programa_id ? `id ${r.programa_id}` : "-")}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {r.categoria_ref?.categoria ?? "-"}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {r.concepto_ref?.concepto ?? (r.concepto_id ? `id ${r.concepto_id}` : "-")}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {Number(r.bruto ?? 0).toFixed(2)}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {Number(r.ss ?? 0).toFixed(2)}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {Number(r.importe_total ?? 0).toFixed(2)}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {Number(r.importe_imputado ?? 0).toFixed(2)}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                  {r.fecha_pago ?? "-"}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {canUserEdit ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Link href={`/nominas?edit=${r.id_contabilidad}#form`}>Editar</Link>

                      <form action={deleteNomina}>
                        <input type="hidden" name="club_id" value={clubId} />
                        <input type="hidden" name="id_contabilidad" value={r.id_contabilidad} />
                        <ConfirmSubmitButton message="¿Seguro que quieres eliminar esta nómina?">
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
                <td colSpan={12} style={{ padding: 12, opacity: 0.8 }}>
                  No hay nóminas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
