import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';
import type { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/afterglow/motion';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { CheckInPreview } from '@/types/api';
import { euros } from './format';
import { ScanResultHeading } from './scan-result-heading';

type Props = {
  /** The text read from the pass; sent again with the entry. */
  code: string;
  preview: CheckInPreview;
  /** An entry is on its way to the server. */
  admitting: boolean;
  onAdmit: (code: string, count: number) => void;
};

/**
 * A good pass: who it is, what to collect, and the button that lets them in. Nobody is in yet.
 * Two guests outside: "Let 2 in" or "Only 1". More than two: a stepper picks how many.
 */
export function ScanValidResult({ code, preview, admitting, onAdmit }: Props) {
  const [chosen, setChosen] = useState(preview.outside);
  const stepper = preview.outside > 2;
  const guests = stepper ? chosen : preview.outside;
  const due = guests * preview.pricePerGuest;

  return (
    <View style={styles.content}>
      <ScanResultHeading
        tone={colors.earned}
        sfSymbol="checkmark"
        ionicon="checkmark"
        title={`Valid. Admit ${preview.outside}`}
        lines={[
          `${preview.guestName}, ${preview.partyTitle}`,
          preview.checkedInCount > 0 ? `${preview.checkedInCount} of ${preview.ticketCount} already inside` : null,
        ]}
      />

      <View style={styles.summary}>
        {preview.pricePerGuest > 0 ? (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Entry, {guests} × {euros(preview.pricePerGuest)}
              </Text>
              <Text style={styles.summaryValue}>{euros(due)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.collectLabel}>Collect at the door</Text>
              <Text style={styles.collectValue}>{euros(due)}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.collectLabel}>Free entry</Text>
        )}
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
          onPress={() => onAdmit(code, guests)}
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
            onPress={() => onAdmit(code, 1)}
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
    padding: spacing.base,
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.label,
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  summaryValue: {
    ...typography.bodyEmphasized,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  collectLabel: {
    ...typography.bodyEmphasized,
    color: colors.label,
    flexShrink: 1,
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
