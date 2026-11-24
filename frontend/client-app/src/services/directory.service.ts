import type { Branch } from "@/types/branch";
import { request } from "@/lib/api-client";

interface MyBranchResponse {
  branch: Branch | null;
}

/**
 * Fetch the authenticated branch account's own branch record.
 * Kept as `getBranchById` for existing callers; `id` is validated against the
 * current account's branch to avoid exposing other branches.
 */
export async function getBranchById(id: string): Promise<Branch | null> {
  const { branch } = await request<MyBranchResponse>("/branches/me");
  if (!branch) return null;
  return branch.id === id ? branch : null;
}
