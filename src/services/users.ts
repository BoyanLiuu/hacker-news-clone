import { cache } from "react";
import { findUser } from "@/fixtures";
import { NotImplementedInStaticPhase, type User } from "@/lib/types";

export const getUserByName = cache(async (username: string): Promise<User | null> => {
  return findUser(username);
});

export async function updateProfile(_input: { about: string; showDead: boolean }): Promise<User> {
  throw new NotImplementedInStaticPhase("updateProfile");
}
