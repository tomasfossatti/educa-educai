import { requireTeacher } from "@/server/auth/guards";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await requireTeacher();
  return children;
}
