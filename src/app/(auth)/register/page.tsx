import type { Metadata } from "next";
import { TextLink } from "@/components/ui/button";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const role = params.role === "teacher" ? "TEACHER" : "STUDENT";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Crear cuenta</h1>
        <p className="mt-1 text-sm text-ink-2">Elegí cómo vas a usar Educai.</p>
      </div>
      <RegisterForm defaultRole={role} />
      <p className="text-sm text-ink-2">
        ¿Ya tenés cuenta? <TextLink href="/login">Ingresar</TextLink>
      </p>
    </div>
  );
}
