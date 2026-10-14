import type { Metadata } from "next";
import { DeepStudentWorkbench } from "@/components/deep-student/deep-student-workbench";
import { requireStudent } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "DeepStudent Workbench",
  description: "AI Learning Workbench para resolución paso a paso de problemas de estudio.",
};

export default async function DeepStudentPage() {
  await requireStudent();

  return (
    <div className="relative w-full flex-1 flex flex-col justify-start">
      <DeepStudentWorkbench />
    </div>
  );
}
