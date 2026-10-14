import type { Metadata } from "next";
import { GetItWorkbench } from "@/components/get-it/get-it-workbench";
import { requireStudent } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Get It - Read it. See it. Get it.",
  description: "Compañero de estudio que transforma documentos en mapas de dominio medible en 4 ejes con técnica Feynman y sandbox visual.",
};

export default async function GetItPage() {
  await requireStudent();

  return (
    <div className="relative w-full flex-1 flex flex-col justify-start">
      <GetItWorkbench />
    </div>
  );
}
