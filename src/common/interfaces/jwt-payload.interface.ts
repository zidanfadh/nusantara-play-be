export interface JwtPayload {
  sub: string; // supabase user id
  email: string;
  aud?: string;
  exp?: number;
  iat?: number;
  role?: string;
}
