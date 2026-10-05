import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudent } from "@/server/auth/guards";
import { getPendingInvites } from "@/server/services/student-home";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Bienvenida" };

export default async function OnboardingPage() {
  const { user, profile } = await requireStudent({ allowIncompleteOnboarding: true });
  if (profile.onboardingCompletedAt) redirect("/s");
  const invites = await getPendingInvites(user.email);
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <p className="mb-8 text-sm font-semibold tracking-tight">Educai</p>
      <OnboardingForm
        firstName={user.name.split(" ")[0]}
        invites={invites.map((i) => ({ id: i.id, courseName: i.course.name, teacherName: i.course.teacher.user.name }))}
      />
    </main>
  );
}
