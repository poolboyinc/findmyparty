export interface PartyMapItem {
  id: string;
  title: string;
  price: number;
  startsAt: string;
  endsAt: string;
  latitude: number;
  longitude: number;
  isSoldOut: boolean;
  imageUrl?: string;
  /** Music genre tag, e.g. "Techno". Optional — older records may omit it. */
  genre?: string;
  /** Tickets sold so far. Drives the "{n} going" count on the consumer card. */
  attendeeCount: number;
}

export interface PartyDetail {
  id: string;
  title: string;
  description: string;
  price: number;
  capacity: number;
  ticketsSold: number;
  remainingCapacity: number;
  startsAt: string;
  endsAt: string;
  latitude: number;
  longitude: number;
  isSoldOut: boolean;
  imageUrl?: string;
}

export interface HostPartyResponse {
  id: string;
  title: string;
  description: string;
  price: number;
  capacity: number;
  ticketsSold: number;
  startsAt: string;
  endsAt: string;
  latitude: number;
  longitude: number;
  status: string;
  imageUrl?: string;
  revenue: number;
  genre?: string;
  performerName?: string;
  performerType?: string;
  featured: boolean;
}

export interface PartyAvailability {
  remainingCapacity: number;
  isSoldOut: boolean;
}

export interface CreatePartyRequest {
  title: string;
  description: string;
  price: number;
  capacity: number;
  startsAt: string;
  endsAt: string;
  latitude: number;
  longitude: number;
  genre?: string;
  performerName?: string;
  performerType?: string;
  featured: boolean;
}

export interface UpdatePartyRequest {
  title: string;
  description: string;
  price: number;
  capacity: number;
  startsAt: string;
  endsAt: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  genre?: string;
  performerName?: string;
  performerType?: string;
  featured: boolean;
}
