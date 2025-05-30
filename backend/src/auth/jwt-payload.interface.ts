export interface JwtPayload {
  sub: string; // user ID
  email: string;
  userName: string;
  iat?: number; // issued at
  exp?: number; // expires at
}

// Добавляем тип для client.data в Socket
export interface AuthenticatedSocketData {
  user: {
    id: string;
    email: string;
    userName: string;
  };
}
