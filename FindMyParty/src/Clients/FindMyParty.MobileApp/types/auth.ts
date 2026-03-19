export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  userName: string;
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  userId: string;
  refreshToken: string;
}

export interface UserInfo {
  userId: string;
  email: string;
  userName: string;
  subscription: string;
  role: string;
  roles: string[];
}

export interface ExternalAuthRequest {
  provider: string;
  idToken: string;
  name?: string;
}

export interface HostProfile {
  venueId: string;
  venueName: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface AssignRoleRequest {
  role: string;
}

export interface UpdateSubscriptionRequest {
  subscription: string;
}

export interface UserListItem {
  id: string;
  email: string;
  userName: string;
  subscription: string;
  role: string;
}

export function getUserInitial(user: UserInfo): string {
  return user.email.length > 0 ? user.email[0].toUpperCase() : '?';
}

export function isPremium(user: UserInfo): boolean {
  return user.subscription === 'Premium';
}

export function getSubscriptionColor(user: UserInfo): string {
  return isPremium(user) ? '#A78BFA' : '#888888';
}

export function getSubscriptionBackgroundColor(user: UserInfo): string {
  return isPremium(user) ? '#2D1B69' : '#1C1C1C';
}

export function getSubscriptionBorderColor(user: UserInfo): string {
  return isPremium(user) ? '#7C3AED' : '#333333';
}
