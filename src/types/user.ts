export type UserRole = "admin" | "member" | "employee";

export type User = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  allowedPlatforms: string[] | null;
  allowedCategories: string[] | null;
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
