import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/server/db";

const JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(): string {
  return Array.from({ length: 6 }, () => JOIN_ALPHABET[randomInt(JOIN_ALPHABET.length)]).join("");
}

/**
 * Crea una cátedra del docente con un código de ingreso único. Lo usan el formulario de alta y la
 * importación desde el LMS. Quien llama ya verificó que es el docente.
 */
export async function createCourseForTeacher(params: { teacherId: string; institutionId: string; name: string; description?: string | null }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = generateJoinCode();
    if (await db.course.findUnique({ where: { joinCode } })) continue;
    return db.course.create({
      data: { name: params.name, description: params.description ?? null, joinCode, teacherId: params.teacherId, institutionId: params.institutionId },
    });
  }
  return null;
}
