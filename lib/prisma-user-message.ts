import { Prisma } from "@prisma/client";

/**
 * Maps Prisma errors to short UI copy. Full detail should be logged server-side.
 */
export function prismaErrorUserMessage(err: unknown, fallback: string): string {
  if (err instanceof Prisma.PrismaClientValidationError) {
    const msg = err.message;
    if (
      msg.includes("Unknown argument `startTime`") ||
      msg.includes("Unknown argument `endTime`")
    ) {
      return "Database client is out of sync with the schema. Stop the dev server, run npx prisma generate, delete the .next folder, then start again.";
    }
    return "The server could not validate this request. Check names and times, then try again.";
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return "A record with this value already exists.";
    }
    if (err.code === "P2025") {
      return "Record was not found or was already removed.";
    }
  }
  return fallback;
}
