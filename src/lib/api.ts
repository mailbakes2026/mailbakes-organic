import { getSessionUser } from "@/lib/auth";
import { bootstrap } from "@/lib/bootstrap";
import { HttpError, jsonError } from "@/lib/service";
import type { UserDTO } from "@/lib/types";

export async function requireUser(): Promise<UserDTO> {
  await bootstrap();
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Sign in required.");
  return user;
}

export async function handle(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    return jsonError(error);
  }
}
