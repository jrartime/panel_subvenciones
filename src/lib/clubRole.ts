import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClubRole = "owner" | "admin" | "manager" | "viewer";

export async function getMyClubRole(clubId: number): Promise<ClubRole | null> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("club_miembros")
    .select("rol")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data?.rol) return null;
  return data.rol as ClubRole;
}

export function canAccessConciliation(role: ClubRole | null) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function canManageMembers(role: ClubRole | null) {
  return role === "owner" || role === "admin";
}

