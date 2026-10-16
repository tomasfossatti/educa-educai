import type { Metadata } from "next";
import { Notice } from "@/components/ui/layout";
import { TextLink } from "@/components/ui/button";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-normal tracking-[-0.312px] text-ink">Ingresar</h1>
        <p className="mt-1 text-sm text-ink-2 font-serif">Educai convierte la evidencia de lo que hacés al aprender en información útil para vos y tu docente.</p>
      </div>
      {params.deleted && <Notice tone="success">Tu cuenta y tus datos fueron eliminados.</Notice>}
      <LoginForm />
      <p className="text-sm text-ink-2">
        ¿No tenés cuenta? <TextLink href="/register">Crear cuenta</TextLink>
      </p>
    </div>
  );
}
