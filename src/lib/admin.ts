// Хардкод админского токена
export const ADMIN_TOKEN = "ad-admin-3c07f7db-1d6e-4a70-9e4a-5f94d995a45c";

export function isValidAdminToken(token: string): boolean {
  return token === ADMIN_TOKEN;
}