import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';
import type { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/afterglow/motion';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { Block } from '@/components/afterglow/block';
import type { CheckInPreview, MoneyLine } from '@/types/api';
import { euros, price } from './format';
import { ScanResultHeading } from './scan-result-heading';

type Props = {
  preview: CheckInPreview;
  /** Found on the saved list with no signal: letting in is saved and checked when the signal returns. */
  offline: boolean;
  /** An entry is on its way to the server. */
  admitting: boolean;
  onAdmit: (count: number) => void;
};

/**
 * The money rows for letting `guests` in. For the whole group they are the server's own lines ("Entry,
 * 2 × €5", "Free before midnight (1 guest)"); for part of it they are worked out from `dueByAdmit`.
 */
function moneyRows(preview: CheckInPreview, guests: number): MoneyLine[] {
  if (guests === preview.outside && preview.lines.length > 0) return preview.lines;
  if (preview.pricePerGuest <= 0) return [];
  const full = guests * preview.pricePerGuest;
  const rows: MoneyLine[] = [{ label: `Entry, ${guests} × ${euros(preview.pricePerGuest)}`, amount: full, perk: false }];
  const discount = (preview.dueByAdmit[guests - 1] ?? full) - full;
  if (discount < 0) rows.push({ label: preview.lines.find((l) => l.perk)?.label ?? 'Perk on this pass', amount: discount, perk: true });
  return rows;
}

/** "€10", or "−€5" for a discount. */
function signed(amount: number): string {
  return amount < 0 ? `−${euros(-amount)}` : euros(amount);
}

/**
 * A good pass (S-21): who it is, what to collect, and the button that lets them in. Nobody is in yet.
 * Two guests outside: "Let 2 in" or "Only 1". More than two: a stepper picks how many.
 */
export function ScanValidResult({ preview, offline, admitting, onAdmit }: Props) {
  const [chosen, setChosen] = useState(preview.outside);
  const stepper = preview.outside > 2;
  const guests = stepper ? chosen : preview.outside;
  const due = preview.dueByAdmit[guests - 1] ?? guests * preview.pricePerGuest;
  const rows = moneyRows(preview, guests);

  return (
    <View style={styles.content}>
      <ScanResultHeading
        tone={colors.earned}
        sfSymbol="checkmark"
        ionicon="checkmark"
        title={`Valid. Admit ${preview.outside}`}
        large
        lines={[
          [preview.guestName, preview.levelName, preview.partyTitle].filter(Boolean).join(', '),
          offline ? 'No signal. Saved, and checked when it returns.' : null,
        ]}
      />

      {preview.skipLine ? <Block label="Skip the line" tone="earned" /> : null}

      <View style={styles.summary}>
        {rows.map((row) => (
          <View key={row.label} style={[styles.summaryRow, styles.divided]}>
            {row.perk ? <Icon sfSymbol="bolt" ionicon="flash-outline" size={18} color={colors.earned} /> : null}
            <Text style={[styles.summaryLabel, row.perk && styles.perk]}>{row.label}</Text>
            <Text style={[styles.summaryValue, row.perk && styles.perk]}>{signed(row.amount)}</Text>
          </View>
        ))}
        <View style={styles.summaryRow}>
          <Text style={styles.collectLabel}>Collect at the door</Text>
          <Text style={styles.collectValue}>{price(due)}</Text>
        </View>
      </View>

      {stepper ? (
        <View style={styles.stepper}>
          <Text style={styles.stepperLabel}>Guests to let in</Text>
          <View style={styles.stepperControls}>
            <StepButton
              label="One guest fewer"
              sfSymbol="minus"
              ionicon="remove"
              disabled={admitting || chosen <= 1}
              onPress={() => setChosen((n) => Math.max(1, n - 1))}
            />
            <Text style={styles.stepperValue} accessibilityLabel={`${chosen} guests`}>
              {chosen}
            </Text>
            <StepButton
              label="One guest more"
              sfSymbol="plus"
              ionicon="add"
              disabled={admitting || chosen >= preview.outside}
              onPress={() => setChosen((n) => Math.min(preview.outside, n + 1))}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.buttons}>
        <PressableScale
          onPress={() => onAdmit(guests)}
          disabled={admitting}
          style={styles.admit}
          accessibilityRole="button"
          accessibilityLabel={`Let ${guests} in`}
          accessibilityState={{ disabled: admitting, busy: admitting }}
        >
          {admitting ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.admitLabel}>Let {guests} in</Text>}
        </PressableScale>
        {preview.outside === 2 ? (
          <PressableScale
            onPress={() => onAdmit(1)}
            disabled={admitting}
            style={[styles.onlyOne, admitting && styles.dimmed]}
            accessibilityRole="button"
            accessibilityLabel="Let only 1 in"
            accessibilityState={{ disabled: admitting }}
          >
            <Text style={styles.onlyOneLabel}>Only 1</Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

type StepButtonProps = {
  label: string;
  sfSymbol: SymbolViewProps['name'];
  ionicon: keyof typeof Ionicons.glyphMap;
  disabled: boolean;
  onPress: () => void;
};

function StepButton({ label, sfSymbol, ionicon, disabled, onPress }: StepButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[styles.step, disabled && styles.dimmed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Icon sfSymbol={sfSymbol} ionicon={ionicon} size={18} color={colors.label} />
    </PressableScale>
  );
}

const BUTTON_HEIGHT = layout.buttonHeight + spacing.sm;

const styles = StyleSheet.create({
  content: {
    gap: spacing.base,
  },
  summary: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.minTouchTarget,
    paddingVertical: spacing.sm,
  },
  // The mock's rows are split by a hairline; the last row ("Collect at the door") has none.
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.label,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  perk: {
    color: colors.earned,
  },
  summaryValue: {
    ...typography.bodyEmphasized,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  collectLabel: {
    ...typography.bodyEmphasized,
    color: colors.label,
    flex: 1,
  },
  collectValue: {
    ...typography.title2,
    fontWeight: '700',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stepperLabel: {
    ...typography.body,
    color: colors.label,
    flexShrink: 1,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepperValue: {
    ...typography.title2,
    fontWeight: '700',
    color: colors.label,
    minWidth: 28,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  step: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radii.chip,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  admit: {
    flex: 1,
    minHeight: BUTTON_HEIGHT,
    borderRadius: radii.button,
    backgroundColor: colors.earned,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  admitLabel: {
    ...typography.bodyEmphasized,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  onlyOne: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  onlyOneLabel: {
    ...typography.bodyEmphasized,
    color: colors.label,
  },
  dimmed: {
    opacity: 0.4,
  },
});
