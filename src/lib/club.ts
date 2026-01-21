import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getActiveClubId(): Promise<number | null> {
  const cookieStore = await cookies();
  const v = cookieStore.get("club_id")?.value;

  if (!v) return null;

  const clubId = Number(v);
  if (!Number.isFinite(clubId) || clubId <= 0) return null;

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  // ✅ Validar pertenencia con club_miembros (no user_clubs)
  const { data, error } = await supabase
    .from("club_miembros")
    .select("id_club_miembro")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return clubId;
}
