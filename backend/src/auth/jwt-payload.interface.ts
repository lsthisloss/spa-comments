export interface JwtPayload {
  sub: string;
  email: string;
  userName: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedSocketData {
  user: {
    id: string;
    email: string;
    userName: string;
    role?: string;
  };
}
