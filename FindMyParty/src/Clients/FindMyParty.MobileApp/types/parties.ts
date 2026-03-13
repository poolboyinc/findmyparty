export interface PartyMapItem {
  id: string;
  title: string;
  price: number;
  startsAt: string;
  latitude: number;
  longitude: number;
  isSoldOut: boolean;
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
}
