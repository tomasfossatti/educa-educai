import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (user) redirect(user.role === "TEACHER" ? "/t" : "/s");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <p className="mb-8 text-sm font-semibold tracking-tight">Educai</p>
      {children}
    </main>
  );
}
