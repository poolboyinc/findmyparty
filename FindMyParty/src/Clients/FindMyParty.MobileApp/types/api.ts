// Shapes returned by the FindMyParty API (FindMyParty/src/Api). This is the block in
// design-proposals/BUILD-3-SPEC.md §2.5, pasted as it stands: change the spec first, then this file.
// JSON is camelCase, dates are ISO-8601 UTC strings, money is a number in euros, ids are GUID strings.
// `?` = may be absent (filled by a server enricher, or only for a signed-in viewer).
// Guests never see an exact crowd number: show `crowdLevel` / `crowdSource` (services/crowd.ts).
// Type-only on purpose: services tested in plain Node import this file with `import type`.

// ── small shared shapes ──
export type CrowdLevel = 'quiet' | '20+' | '50+' | '100+' | '200+';
export type CrowdSource = 'live' | 'expected';
export interface FriendsHere { count: number; names: string[]; initials: string[] }   // names ≤ 2, initials ≤ 3
export interface PartyAct { name: string; role: string | null; startsAt: string }
export interface Footprint { ring: [number, number][]; heightM: number }             // [lng, lat]
export interface MoneyLine { label: string; amount: number; perk: boolean }           // amount < 0 for a discount

// ── cities ──
export interface City {
  slug: string; name: string; latitude: number; longitude: number; radiusKm: number;
  outTonight: number;      // rounded down; show as "1,200+"
  venuesLit: number; venueCount: number;
}

// ── parties ──
export interface Party {
  id: string; title: string; price: number; startsAt: string; endsAt: string;
  latitude: number; longitude: number; isSoldOut: boolean; imageUrl: string | null; genre: string | null;
  attendeeCount: number; venueId: string | null; venueName: string | null;
  crowdLevel: CrowdLevel | null; crowdSource: CrowdSource | null;
  city: string | null; venueArea: string | null; ageLimit: number | null; lineupText: string | null;
  sponsored?: boolean;            // A7
  friendsHere?: FriendsHere;      // A6
}
export interface PartyPerk { perkKey: string; kind: PerkKind; title: string }        // "Free for you before midnight"
export interface PartyDetail {
  id: string; title: string; description: string; price: number; capacity: number; ticketsSold: number;
  remainingCapacity: number; startsAt: string; endsAt: string; latitude: number; longitude: number;
  isSoldOut: boolean; imageUrl: string | null; venueId: string | null; venueName: string | null;
  genre: string | null; performerName: string | null; performerType: string | null;
  crowdLevel: CrowdLevel | null; crowdSource: CrowdSource | null;
  city: string | null; venueArea: string | null; venueAddress: string | null;
  ageLimit: number | null; holdMinutes: number; acts: PartyAct[];
  sponsored?: boolean; friendsHere?: FriendsHere; perk?: PartyPerk;
}
export interface PartyInput {
  title: string; description: string; price: number; capacity: number; startsAt: string; endsAt: string;
  latitude: number; longitude: number; imageUrl?: string | null; genre?: string | null;
  ageLimit?: number | null;       // 16, 18, 21 or null
  holdMinutes?: number;           // 15–600, default 90
  acts?: PartyAct[];              // 0–8
}
export interface HostParty {
  id: string; title: string; description: string; price: number; capacity: number; ticketsSold: number;
  startsAt: string; endsAt: string; latitude: number; longitude: number;
  status: 'Draft' | 'Published' | 'Cancelled' | 'SoldOut'; imageUrl: string | null; revenue: number;
  genre: string | null; performerName: string | null; performerType: string | null; featured: boolean;
  ageLimit: number | null; holdMinutes: number; acts: PartyAct[]; lineupText: string | null;
}

// ── venues ──
export interface VenueSummary {
  id: string; name: string; latitude: number; longitude: number;
  crowdLevel: CrowdLevel | null; crowdSource: CrowdSource | null;
  partyId: string | null; partyTitle: string | null;
  city: string; kind: string | null; area: string | null;
  partyGenre: string | null; partyPrice: number | null; partyStartsAt: string | null; partyEndsAt: string | null;
  partyLineupText: string | null; footprint: Footprint | null;
  friendsHere?: FriendsHere;
}
export interface VenueHour { at: string; level: number; kind: 'past' | 'now' | 'usual' }
export interface VenueTonight { hours: VenueHour[]; trend: 'filling' | 'steady' | 'thinning' | null; usualPeakAt: string | null }
export interface VenuePerk { perkKey: string; kind: PerkKind; title: string; subtitle: string; sponsored: boolean }
export interface Venue {
  id: string; name: string; address: string; latitude: number; longitude: number;
  workingHoursOpen: string | null; workingHoursClose: string | null; workingDays: string | null;
  crowdLevel: CrowdLevel | null; crowdSource: CrowdSource | null; parties: Party[];
  city: string; kind: string | null; area: string | null; imageUrl: string | null; footprint: Footprint | null;
  following: boolean;             // false when signed out
  tonight: VenueTonight | null;   // null when nothing is on tonight
  perks?: VenuePerk[];            // A5: the ones the viewer holds here
  friendsHere?: FriendsHere;      // A6
}
export interface HostVenue {
  venueId: string; venueName: string; address: string; latitude: number; longitude: number;
  workingHoursOpen: string | null; workingHoursClose: string | null; workingDays: string | null;
  city: string; kind: string | null; area: string | null; imageUrl: string | null; followerCount: number;
}

// ── me ──
export interface SoundShare { genre: string; percent: number }                        // three at most, sum 100
export interface Me {
  id: string; userName: string; handle: string; displayName: string; email: string; roles: string[];
  createdAt: string; city: string | null; taste: string[]; sound: SoundShare[];
  level: { name: string; number: number }; glowLifetime: number;
  privacy: { shareWithFriends: boolean; invisibleUntil: string | null; suspended: boolean };
  notifications: { venues: boolean; friends: boolean; nights: boolean };
  hasPassword: boolean; venueId: string | null;
}
export interface Saved { parties: string[]; venues: string[] }

// ── bookings and passes ──
export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Expired';
export interface QuotePerk { perkKey: string; title: string; appliesToGuests: number; discount: number; validUntil: string | null }
export interface BookingQuote {
  partyId: string; ticketCount: number; maxGuests: number; pricePerGuest: number; subtotal: number;
  perk: QuotePerk | null;         // title as drawn: "Free before midnight (you)"
  skipLine: boolean; totalAtDoor: number; heldUntil: string; payNowAvailable: false;
}
export interface GuestPass { id: string; status: 'unclaimed' | 'claimed' | 'in'; guestName: string | null; url: string; createdAt: string }
export interface GuestPassPreview { partyTitle: string; venueName: string | null; startsAt: string; hostName: string; status: 'open' | 'taken' | 'gone' }
export interface BookingParty {
  id: string; title: string; imageUrl: string | null; startsAt: string; endsAt: string; latitude: number; longitude: number;
  genre: string | null; performerName: string | null; performerType: string | null; status: string;
  venueId: string | null; venueName: string | null; venueArea: string | null;
}
export interface Booking {
  id: string;                     // for a guest row this is the guest pass id
  partyId: string; ticketCount: number; totalPrice: number; status: BookingStatus;
  createdAt: string; partyEndsAt: string; party: BookingParty | null;
  checkedInCount: number; firstCheckedInAt: string | null;
  heldUntil: string | null; perkTitle: string | null; perkDiscount: number; amountDue: number; skipLine: boolean;
  guestPasses: GuestPass[];       // passes this booker handed out
  guestPassId: string | null;     // set when this row is a guest pass someone gave me
  guestOf: string | null;         // "Vule"
}
export interface Pass {
  bookingId: string;              // the booking id, or the guest pass id when kind is 'guest'
  kind: 'booking' | 'guest'; codePrefix: 'fmp1' | 'fmpg1'; codeId: string;   // codeId: 32 hex, goes into the QR
  secret: string; stepSeconds: number; ticketCount: number; checkedInCount: number; status: BookingStatus;
  partyId: string; partyTitle: string; venueName: string | null; venueArea: string | null;
  startsAt: string; endsAt: string; totalPrice: number;
  admit: number;                  // guests this code still lets in
  amountDue: number; perkTitle: string | null; skipLine: boolean; heldUntil: string | null;
  holderName: string;             // "Vule M."
  levelName: string;              // "Flame"
  guestOf: string | null;
}
export interface HostBooking {
  id: string; partyId: string; ticketCount: number; totalPrice: number; status: BookingStatus; createdAt: string;
  partyEndsAt: string; guestName: string; checkedInCount: number; heldUntil: string | null; amountDue: number;
}

// ── the door ──
export interface CheckInPreview {
  bookingId: string; kind: 'booking' | 'guest'; partyId: string; partyTitle: string;
  guestName: string;              // "Vule M."
  levelName: string; ticketCount: number; checkedInCount: number;
  outside: number;                // guests this code can still let in
  pricePerGuest: number;
  lines: MoneyLine[];             // for admitting all of `outside`: "Entry, 2 × €5", "Free before midnight (1 guest)"
  dueByAdmit: number[];           // dueByAdmit[n-1] = what to collect when letting n in
  skipLine: boolean;
}
export interface CheckInResult {
  bookingId: string; guestName: string; levelName: string; admitted: number; ticketCount: number;
  checkedInCount: number; amountDue: number; partyTitle: string; door: string; clientScanId: string | null;
}
export interface BatchScanItem { clientScanId: string; code: string; admit: number; scannedAt: string }
export interface BatchScanResult {
  clientScanId: string; status: 'admitted' | 'refused';
  result?: CheckInResult;         // when admitted
  code?: string; title?: string;  // when refused: the problem code and sentence
}
export interface DoorContext {
  venueId: string; venueName: string; doorName: string; role: 'host' | 'door';
  party: { id: string; title: string; startsAt: string; endsAt: string; capacity: number; checkedIn: number } | null;  // on now
}
export interface ManifestPass {
  codeId: string; kind: 'booking' | 'guest'; guestName: string; levelName: string;
  outside: number; pricePerGuest: number; dueByAdmit: number[]; skipLine: boolean;
}
export interface DoorManifest { partyId: string; partyTitle: string; generatedAt: string; capacity: number; checkedIn: number; passes: ManifestPass[] }
export interface DoorStaff { id: string; name: string; doorName: string; userName: string; createdAt: string; lastScanAt: string | null }
export interface DoorStaffCreated extends DoorStaff { password: string }
export interface PartyLive {
  partyTitle: string; startsAt: string; endsAt: string; status: 'upcoming' | 'live' | 'ended';
  capacity: number; passesOut: number; checkedIn: number; notHereYet: number; takenAtDoor: number;
  arrivals: { from: string; count: number }[];   // eight quarter-hours ending at min(now, endsAt), oldest first
  newFaces: number;
  beam: { rank: number; of: number; level: CrowdLevel; leaderName: string | null; runnerUpName: string | null } | null;
}

// ── glow ──
export type GlowPartKind = 'scan' | 'beforeMidnight' | 'firstAtVenue' | 'streak' | 'multiplier' | 'referral' | 'claim';
export interface GlowPart { kind: GlowPartKind; points: number; label: string }
// labels: "check-in", "before midnight", "first time here", "streak", "×1.5 streak bonus", "friend's first night", "claimed"
export interface GlowAward {
  bookingId: string; at: string; venueId: string | null; venueName: string | null;
  points: number; parts: GlowPart[]; streakWeeks: number;
}
export type BadgeId = 'first-night' | 'before-midnight' | 'explorer' | 'brought-a-friend' | 'regular';
export interface GlowBadge { id: BadgeId; label: string; hint: string; earned: boolean; have: number; need: number }
export interface GlowNight { bookingId: string; date: string; at: string; title: string; venueName: string | null; points: number }  // title "Scanned in at Kula"
export interface GlowSummary {
  lifetime: number; balance: number;
  level: { name: string; number: number; min: number }; next: { name: string; min: number } | null; toNext: number | null;
  ring: number; ladder: number; levels: { name: string; min: number }[];
  streakWeeks: number; multiplierFromWeek: number;     // 4
  nightsOut: number; venuesLit: number; venuesLitIds: string[];
  badges: GlowBadge[];            // always the five, in the order of BadgeId
  lastNights: GlowNight[];        // newest first, 12 at most
}
export type PerkKind = 'freeEntryBefore' | 'plusOneFree' | 'skipLine' | 'sponsored';
export interface PerkClaim {
  id: string; perkId: string; title: string; venueName: string; qrText: string;
  status: 'claimed' | 'redeemed' | 'expired'; claimedAt: string; expiresAt: string; redeemedAt: string | null;
}
export interface PerkItem {
  id: string;                     // a level perk: its kind; a sponsored perk: its guid
  kind: PerkKind; title: string;
  subtitle: string;               // "Monkey, Kula, Blok 5, Flame level" | "Tonight at Monkey, 400 Glow" | "Unlocks at Blaze"
  state: 'held' | 'claimable' | 'claimed' | 'short' | 'locked';   // short = not enough Glow to spend
  sponsored: boolean; sponsorName: string | null; logoText: string | null;
  colorTop: string | null; colorBottom: string | null; ink: string | null;
  glowCost: number; minLevel: number; minLevelName: string;
  venueIds: string[]; venueNames: string[]; endsAt: string | null; claim: PerkClaim | null;
}
export interface HostPerk { kind: Exclude<PerkKind, 'sponsored'>; title: string; minLevelName: string; enabled: boolean; untilLocalTime: string | null }
export interface SponsoredPerkInput {
  title: string; sponsorName: string; logoText: string; colorTop: string; colorBottom: string; ink: string;
  venueId: string; minLevel: number; glowCost: number; stock: number | null; startsAt: string; endsAt: string;
}
export interface NightSummary { date: string; cityName: string; venueCount: number; glow: number }
export interface NightRecap {
  date: string; cityName: string; headline: string; minutesOut: number;
  venues: { id: string; name: string; latitude: number; longitude: number }[];   // in the order visited
  glow: number; mostlyGenre: string | null; handle: string; levelName: string;
  shareUrl: string | null;        // null until the guest shares it
}

// ── friends ──
export type Relation = 'none' | 'friend' | 'requested' | 'incoming' | 'blocked';
export interface UserCard { userId: string; handle: string; displayName: string; initial: string; levelName: string; relation: Relation; requestId: string | null }
export interface Friend { userId: string; handle: string; displayName: string; initial: string; levelName: string; since: string; sharing: boolean }
export interface FriendRequest { id: string; user: UserCard; createdAt: string }
export interface FriendsList {
  friends: Friend[]; incoming: FriendRequest[]; outgoing: FriendRequest[];
  sharing: boolean; invisibleUntil: string | null; suspended: boolean; inviteUrl: string;
}
export interface FriendsAtVenue {
  venueId: string; venueName: string; latitude: number; longitude: number; count: number;
  friends: { userId: string; displayName: string; initial: string }[];           // three at most
}
export interface FriendsOut {
  sharing: boolean;               // false: the layer shows the "switch on" prompt and `venues` is empty
  friendsOut: number;
  headline: { name: string; others: number; venueName: string } | null;          // "Mila and 2 more at Dr. House"
  venues: FriendsAtVenue[];
}
export type ReportReason = 'harassment' | 'fakeProfile' | 'spam' | 'other';
export interface AdminReport {
  id: string; reason: ReportReason; note: string | null; createdAt: string; status: 'open' | 'resolved';
  reporter: { userId: string; handle: string }; reported: { userId: string; handle: string; displayName: string; openReports: number };
}

// ── signs ──
export type SignFormat = 'facade' | 'hologram' | 'tonightSlot';
export interface SignSpot {
  id: string; city: string; number: number; format: 'facade' | 'hologram'; label: string; area: string;
  latitude: number; longitude: number; bearingDeg: number; baseHeightM: number; widthM: number; heightM: number;
  buildingHeightM: number; venueId: string | null; weeklyPrice: number;
  free: boolean;                  // in the week asked for
}
export type SignSpotInput = Omit<SignSpot, 'id' | 'free'> & { active: boolean };
export interface MapSign {
  id: string; format: 'facade' | 'hologram'; own: boolean;      // own: a venue's own wall, drawn without "Ad"
  advertiser: string; text: string;                              // "VOLT", "AURA|SPRITZ" (| = line break)
  colorTop: string; colorBottom: string; ink: string; artworkUrl: string | null;
  spot: SignSpot;
  card: { title: string; subtitle: string; logoText: string; perkId: string | null; partyId: string | null; venueId: string | null };
}
export interface SignWeek { id: string; startsOn: string; endsOn: string; label: string }   // "2026-W46", "This week"
export interface SignFormatInfo { format: SignFormat; title: string; price: number; unit: 'week' | 'night'; total: number; free: number }
export interface SignBooking {
  id: string; format: SignFormat; spot: SignSpot | null; partyId: string | null; partyTitle: string | null;
  text: string; colorTop: string; colorBottom: string; ink: string; artworkUrl: string | null;
  startsOn: string; endsOn: string; price: number;
  status: 'pendingReview' | 'approved' | 'rejected' | 'cancelled'; reviewNote: string | null;
  invoiceStatus: 'toInvoice' | 'invoiced'; createdAt: string;
}
export interface SignOptions {
  week: SignWeek; weeks: SignWeek[];                             // this week and the next eight
  formats: SignFormatInfo[];                                     // facade, hologram, tonightSlot
  spots: SignSpot[];                                             // the city's spots with `free` for `week`
  parties: { id: string; title: string; startsAt: string; imageUrl: string | null }[];   // the host's parties still to come
  mine: SignBooking[];                                           // newest first
}
export interface SignInput {
  format: SignFormat; spotId?: string; week?: string;            // facade, hologram
  partyId?: string;                                              // needed for tonightSlot; optional link otherwise
  text: string; colorTop: string; colorBottom: string; ink: string; artworkUrl?: string | null;
}
export interface AdminSign extends SignBooking { advertiserName: string; venueName: string | null; bookedBy: string }
