export interface User {
  user_id: string;
  email: string;
  name: string;
  role: 'admin' | 'analyst';
  created_at?: string;
  is_active?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
  role: string;
}
