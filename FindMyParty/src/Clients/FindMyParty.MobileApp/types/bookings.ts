export interface BookingItem {
  id: string;
  partyId: string;
  ticketCount: number;
  totalPrice: number;
  status: string;
  createdAt: string;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'Confirmed': return '#22C55E';
    case 'Cancelled': return '#6B7280';
    default: return '#F59E0B'; // Pending
  }
}

export function getStatusBackgroundColor(status: string): string {
  switch (status) {
    case 'Confirmed': return '#0A2D0A';
    case 'Cancelled': return '#1C1C1C';
    default: return '#2D1F00'; // Pending
  }
}

export function getStatusBorderColor(status: string): string {
  switch (status) {
    case 'Confirmed': return '#22C55E';
    case 'Cancelled': return '#4B5563';
    default: return '#F59E0B'; // Pending
  }
}
