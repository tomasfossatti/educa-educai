import { redirect } from "next/navigation";
import { requireStudent } from "@/server/auth/guards";

/** Dirección vieja de "Tu contexto": todo eso vive ahora en Mis datos. */
export default async function OldContextPage() {
  await requireStudent();
  redirect("/s/mis-datos");
}
