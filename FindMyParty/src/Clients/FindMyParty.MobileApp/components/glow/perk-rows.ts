// "Your perks" on the Glow tab (S-17): what one row shows for a perk in each state.
// Pure, tested in services/__tests__/perkRows.test.mjs.

import { formatGlow } from '../../services/glow.ts';
import type { PerkItem } from '../../types/api.ts';

export type PerkIcon = 'bolt' | 'gift' | 'lock';

/** The icon's colour: lime for what you hold, amber for what a brand pays for, dim for what is locked. */
export type PerkTone = 'earned' | 'paid' | 'dim';

export interface PerkRow {
  key: string;
  icon: PerkIcon;
  tone: PerkTone;
  title: string;
  /** "Sponsored" in amber after the title. */
  sponsored: boolean;
  subtitle: string;
  /** The whole row is drawn faint (a locked perk). */
  dimmed: boolean;
  /** A lime check at the end (a perk you hold). */
  check: boolean;
  /** The button at the end: "Claim", or "Show" once claimed. Dimmed when the balance is too low. */
  button: { label: 'Claim' | 'Show'; dimmed: boolean } | null;
  /** The perk to open on `perk/[id]` when the row is tapped, or null when there is nothing to open. */
  opens: string | null;
  /** Read out by screen readers. */
  spoken: string;
}

/**
 * One row of "Your perks".
 * - held: lime bolt, title, subtitle, lime check.
 * - sponsored: amber gift, title with "Sponsored", subtitle, "Claim"; claimed: "Show";
 *   short (not enough Glow): "Claim" dimmed and "{cost} Glow, you have {balance}".
 * - locked: lock, the whole row dimmed, "Unlocks at {Level}".
 * `balance` is `GlowSummary.balance`, or null while it is not known.
 */
export function perkRow(perk: PerkItem, balance: number | null): PerkRow {
  const base = { key: perk.id, title: perk.title, sponsored: perk.sponsored, subtitle: perk.subtitle };
  const tag = perk.sponsored ? `${perk.title}, sponsored` : perk.title;
  const spoken = (subtitle: string, state?: string) => [tag, subtitle, state].filter(Boolean).join('. ') + '.';

  switch (perk.state) {
    case 'held':
      return {
        ...base,
        icon: perk.sponsored ? 'gift' : 'bolt',
        tone: 'earned',
        dimmed: false,
        check: true,
        button: null,
        opens: null,
        spoken: spoken(perk.subtitle, 'You have it'),
      };
    case 'claimable':
      return {
        ...base,
        icon: 'gift',
        tone: 'paid',
        dimmed: false,
        check: false,
        button: { label: 'Claim', dimmed: false },
        opens: perk.id,
        spoken: spoken(perk.subtitle),
      };
    case 'claimed':
      return {
        ...base,
        icon: 'gift',
        tone: 'paid',
        dimmed: false,
        check: false,
        button: { label: 'Show', dimmed: false },
        opens: perk.id,
        spoken: spoken(perk.subtitle, 'Claimed'),
      };
    case 'short': {
      const subtitle =
        balance === null ? perk.subtitle : `${formatGlow(perk.glowCost)} Glow, you have ${formatGlow(Math.max(0, balance))}`;
      return {
        ...base,
        subtitle,
        icon: 'gift',
        tone: 'paid',
        dimmed: false,
        check: false,
        button: { label: 'Claim', dimmed: true },
        opens: perk.id,
        spoken: spoken(subtitle, 'Not enough Glow yet'),
      };
    }
    case 'locked':
      return {
        ...base,
        icon: 'lock',
        tone: 'dim',
        dimmed: true,
        check: false,
        button: null,
        opens: null,
        spoken: spoken(perk.subtitle, 'Locked'),
      };
  }
}
