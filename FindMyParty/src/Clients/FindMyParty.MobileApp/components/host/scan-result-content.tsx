import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/afterglow/motion';
import { PrimaryButton } from '@/components/ui/primary-button';
import { colors, spacing } from '@/theme';
import { euros } from './format';
import { ScanResultHeading } from './scan-result-heading';
import { ScanValidResult } from './scan-valid-result';
import type { ScanState } from './use-door-scan';

/** The states that have something to show in the sheet. */
export type ShownScanState = Exclude<ScanState, { phase: 'idle' } | { phase: 'checking' }>;

type Props = {
  state: ShownScanState;
  onAdmit: (count: number) => void;
  /** Closes the sheet; scanning resumes once it is gone. */
  onClose: () => void;
  onSignIn: () => void;
};

/** What the door sees after a scan: who to let in, that they are in, a redeemed perk, or why not. */
export function ScanResultContent({ state, onAdmit, onClose, onSignIn }: Props) {
  switch (state.phase) {
    case 'valid':
      return (
        <ScanValidResult
          // Keyed by pass, so nothing chosen for the last pass carries over.
          key={state.clientScanId}
          preview={state.preview}
          offline={state.offline}
          admitting={state.admitting}
          onAdmit={onAdmit}
        />
      );
    case 'admitted':
      return <AdmittedResult state={state} onClose={onClose} />;
    case 'redeemed':
      return (
        <Tappable onClose={onClose} label={`Redeemed. ${state.title}, ${state.guestName}. Scan next`}>
          <ScanResultHeading
            tone={colors.earned}
            sfSymbol="checkmark"
            ionicon="checkmark"
            title="Redeemed"
            large
            lines={[state.title, state.guestName]}
          />
        </Tappable>
      );
    case 'refused':
      return (
        <View style={styles.content}>
          <ScanResultHeading
            tone={colors.danger}
            iconColor={colors.label}
            sfSymbol="xmark"
            ionicon="close"
            title={state.reason}
            lines={[]}
          />
          {state.signedOut ? <PrimaryButton label="Sign in" onPress={onSignIn} /> : <PrimaryButton label="Scan next" onPress={onClose} />}
        </View>
      );
  }
}

/** A result that closes by itself; a tap closes it sooner. */
function Tappable({ onClose, label, children }: { onClose: () => void; label: string; children: React.ReactNode }) {
  return (
    <PressableScale onPress={onClose} haptic={false} scaleTo={1} style={styles.content} accessibilityRole="button" accessibilityLabel={label}>
      {children}
    </PressableScale>
  );
}

/** "2 in", with what to collect. With no signal it says the entry is saved and checked later. */
function AdmittedResult({ state, onClose }: { state: Extract<ShownScanState, { phase: 'admitted' }>; onClose: () => void }) {
  const money = state.amountDue > 0 ? `Collect ${euros(state.amountDue)} at the door` : 'Nothing to collect';
  const lines = [`${state.guestName}, ${state.partyTitle}`, money, state.offline ? 'No signal. Saved, and checked when it returns.' : null];
  return (
    <Tappable onClose={onClose} label={`${state.admitted} in. ${lines.filter(Boolean).join('. ')}. Scan next`}>
      <ScanResultHeading tone={colors.earned} sfSymbol="checkmark" ionicon="checkmark" title={`${state.admitted} in`} large lines={lines} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.base,
  },
});
