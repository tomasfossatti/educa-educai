"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsFrom, text, type ActionState } from "@/lib/forms";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession } from "@/server/auth/session";
import { db } from "@/server/db";

const registerSchema = z
  .object({
    role: z.enum(["STUDENT", "TEACHER"]),
    name: z.string().min(2, "Ingresá tu nombre.").max(120),
    email: z.email("Ingresá un email válido.").max(200),
    password: z.string().min(10, "La contraseña debe tener al menos 10 caracteres.").max(200),
    institution: z.string().max(160).optional(),
  })
  .refine((v) => v.role === "STUDENT" || (v.institution && v.institution.length >= 2), {
    message: "Ingresá el nombre de tu institución.",
    path: ["institution"],
  });

export async function registerAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    role: text(formData, "role"),
    name: text(formData, "name"),
    email: text(formData, "email").toLowerCase(),
    password: formData.get("password"),
    institution: text(formData, "institution") || undefined,
  });
  if (!parsed.success) return { error: "Revisá los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const data = parsed.data;

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) return { error: "Ya existe una cuenta con ese email.", fieldErrors: { email: "Ya está registrado." } };

  const passwordHash = await hashPassword(data.password);
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email: data.email, name: data.name, passwordHash, role: data.role },
    });
    if (data.role === "TEACHER") {
      const institution = await tx.institution.create({ data: { name: data.institution! } });
      await tx.teacherProfile.create({ data: { userId: created.id, institutionId: institution.id } });
    } else {
      await tx.studentProfile.create({ data: { userId: created.id } });
    }
    return created;
  });

  await createSession(user.id);
  redirect(user.role === "TEACHER" ? "/t" : "/s/onboarding");
}

const loginSchema = z.object({
  email: z.email("Ingresá un email válido."),
  password: z.string().min(1, "Ingresá tu contraseña."),
});

export async function loginAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ email: text(formData, "email").toLowerCase(), password: formData.get("password") });
  if (!parsed.success) return { error: "Revisá los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  // Mismo mensaje para email inexistente o contraseña incorrecta.
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Email o contraseña incorrectos." };
  }
  await createSession(user.id);
  redirect(user.role === "TEACHER" ? "/t" : "/s");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
