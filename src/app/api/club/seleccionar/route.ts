import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const clubId = Number(form.get("club_id"));

  if (!clubId || !Number.isFinite(clubId) || clubId <= 0) {
    return NextResponse.json({ error: "club_id inválido" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // ✅ Validar pertenencia con club_miembros (NO user_clubs)
  const { data: member, error } = await supabase
    .from("club_miembros")
    .select("id_club_miembro")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !member) {
    return NextResponse.json(
      { error: "No autorizado para ese club" },
      { status: 403 }
    );
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("club_id", String(clubId), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // 1 año
  });

  return res;
}

