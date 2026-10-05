import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24">
      <h1 className="text-xl font-semibold">No encontramos esta página</h1>
      <p className="mt-2 text-sm text-ink-2">
        Puede que no exista o que no tengas acceso. En Educai cada persona solo ve la información de sus propias materias.
      </p>
      <ButtonLink href="/" className="mt-6">
        Volver al inicio
      </ButtonLink>
    </main>
  );
}
