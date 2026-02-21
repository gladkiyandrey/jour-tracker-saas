import { getSessionEmail } from "@/lib/auth";

export async function getCurrentUserEmail() {
  return getSessionEmail();
}
