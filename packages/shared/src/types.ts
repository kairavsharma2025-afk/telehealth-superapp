export interface JwtPayload {
  sub: string;
  role: import("./roles.js").UserRole;
  iat: number;
  exp: number;
}

export interface PaginationQuery {
  limit: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
}
