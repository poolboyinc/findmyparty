import { authService } from './authService';
import { ApiConstants } from '../constants/api';
import type { AssignRoleRequest, UpdateSubscriptionRequest, UserListItem } from '../types/auth';

export const adminService = {
  async getUsers(page = 1, pageSize = 20): Promise<UserListItem[]> {
    const token = await authService.getToken();
    if (!token) return [];

    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const response = await fetch(`${ApiConstants.GatewayBaseUrl}/api/users?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    return response.json();
  },

  async assignRole(userId: string, role: string): Promise<boolean> {
    const token = await authService.getToken();
    if (!token) return false;

    const response = await fetch(`${ApiConstants.GatewayBaseUrl}/api/users/${userId}/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role } satisfies AssignRoleRequest),
    });
    return response.ok;
  },

  async removeRole(userId: string, role: string): Promise<boolean> {
    const token = await authService.getToken();
    if (!token) return false;

    const response = await fetch(
      `${ApiConstants.GatewayBaseUrl}/api/users/${userId}/roles/${role}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.ok;
  },

  async updateSubscription(userId: string, subscription: string): Promise<boolean> {
    const token = await authService.getToken();
    if (!token) return false;

    const response = await fetch(
      `${ApiConstants.GatewayBaseUrl}/api/users/${userId}/subscription`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subscription } satisfies UpdateSubscriptionRequest),
      }
    );
    return response.ok;
  },
};
