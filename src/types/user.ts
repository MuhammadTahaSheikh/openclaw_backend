export type UserRole = "admin" | "member";

export type User = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type JwtPayload = {
  userId: number;
  email: string;
};
