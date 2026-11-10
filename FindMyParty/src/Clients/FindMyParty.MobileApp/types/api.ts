// Shapes returned by the FindMyParty API (FindMyParty/src/Api). Dates are ISO strings in UTC.

import type { CrowdLevel, CrowdSource } from '../services/crowd.ts';

export interface Party {
  id: string;
  title: string;
  price: number;
  startsAt: string;
  endsAt: string;
  latitude: number;
  longitude: number;
  isSoldOut: boolean;
  imageUrl: string | null;
  genre: string | null;
  /** Exact passes taken. Prefer `crowdLevel` for anything shown to guests. */
  attendeeCount: number;
  venueId: string | null;
  venueName: string | null;
  crowdLevel: CrowdLevel | null;
  crowdSource: CrowdSource | null;
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
  imageUrl: string | null;
  venueId: string | null;
  venueName: string | null;
  genre: string | null;
  performerName: string | null;
  performerType: string | null;
}

/** A venue on the map: one beam, with its next open party. */
export interface VenueSummary {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  crowdLevel: CrowdLevel | null;
  crowdSource: CrowdSource | null;
  partyId: string | null;
  partyTitle: string | null;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  workingHoursOpen: string | null;
  workingHoursClose: string | null;
  workingDays: string | null;
  crowdLevel: CrowdLevel | null;
  crowdSource: CrowdSource | null;
  /** Open parties, soonest first. */
  parties: Party[];
}

export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled';

export interface BookingParty {
  id: string;
  title: string;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  latitude: number;
  longitude: number;
  genre: string | null;
  performerName: string | null;
  performerType: string | null;
  status: string;
  venueId: string | null;
  venueName: string | null;
}

export interface Booking {
  id: string;
  partyId: string;
  ticketCount: number;
  totalPrice: number;
  status: BookingStatus;
  createdAt: string;
  partyEndsAt: string;
  party: BookingParty | null;
  /** Guests from this booking already let in at the door. */
  checkedInCount: number;
  /** When the door first let someone in on this booking (UTC). Optional until every server sends it. */
  firstCheckedInAt?: string | null;
}

/** What the phone needs to draw a pass and keep its door code changing offline. See services/passCode.ts. */
export interface Pass {
  bookingId: string;
  secret: string;
  stepSeconds: number;
  ticketCount: number;
  checkedInCount: number;
  status: BookingStatus;
  partyId: string;
  partyTitle: string;
  venueName: string | null;
  startsAt: string;
  endsAt: string;
  totalPrice: number;
}

/** What the door sees after scanning, before letting anyone in. Nothing has changed yet. */
export interface CheckInPreview {
  bookingId: string;
  guestName: string;
  ticketCount: number;
  checkedInCount: number;
  /** Guests from this pass still to come in. */
  outside: number;
  pricePerGuest: number;
  partyTitle: string;
}

/** Answer to a successful door scan. */
export interface CheckInResult {
  bookingId: string;
  guestName: string;
  admitted: number;
  ticketCount: number;
  checkedInCount: number;
  amountDue: number;
  partyTitle: string;
}

/** The night in numbers, for the party's host. */
export interface PartyLive {
  capacity: number;
  passesOut: number;
  checkedIn: number;
  notHereYet: number;
  takenAtDoor: number;
  /** Eight quarter-hours, oldest first. */
  arrivals: { from: string; count: number }[];
}

export interface HostParty {
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
  status: 'Draft' | 'Published' | 'Cancelled' | 'SoldOut';
  imageUrl: string | null;
  revenue: number;
  genre: string | null;
  performerName: string | null;
  performerType: string | null;
  featured: boolean;
}

export interface HostVenue {
  venueId: string;
  venueName: string;
  address: string;
  latitude: number;
  longitude: number;
  workingHoursOpen: string | null;
  workingHoursClose: string | null;
  workingDays: string | null;
}
