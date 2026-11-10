import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/afterglow/motion';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ApiError } from '@/services/api';
import { errorText } from '@/services/errorText';
import { colors, spacing } from '@/theme';
import { clock, euros } from './format';
import { ScanResultHeading } from './scan-result-heading';
import { ScanValidResult } from './scan-valid-result';
import type { ScanState } from './use-door-scan';

/** The states that have something to show in the sheet. */
export type ShownScanState = Exclude<ScanState, { phase: 'idle' } | { phase: 'checking' }>;

type Props = {
  state: ShownScanState;
  onAdmit: (code: string, count: number) => void;
  onRetry: (code: string, during: 'check' | 'admit') => void;
  /** Closes the sheet; scanning resumes once it is gone. */
  onClose: () => void;
  onSignIn: () => void;
};

/** What the door sees after a scan: who to let in, that they are in, or why not. */
export function ScanResultContent({ state, onAdmit, onRetry, onClose, onSignIn }: Props) {
  switch (state.phase) {
    case 'valid':
      return (
        <ScanValidResult
          // Keyed by booking, so the chosen number of guests never carries over from the last pass.
          key={state.preview.bookingId}
          code={state.code}
          preview={state.preview}
          admitting={state.admitting}
          onAdmit={onAdmit}
        />
      );
    case 'admitted':
      return <AdmittedResult state={state} onClose={onClose} />;
    case 'offline':
      return <OfflineResult state={state} onRetry={onRetry} onClose={onClose} />;
    case 'refused':
      return <RefusedResult error={state.error} onClose={onClose} onSignIn={onSignIn} />;
  }
}

/** "2 in". Closes by itself; a tap closes it sooner. */
function AdmittedResult({ state, onClose }: { state: Extract<ShownScanState, { phase: 'admitted' }>; onClose: () => void }) {
  const { result } = state;
  const money = result.amountDue > 0 ? `Collect ${euros(result.amountDue)} at the door` : 'Free entry';

  return (
    <PressableScale
      onPress={onClose}
      haptic={false}
      scaleTo={1}
      style={styles.content}
      accessibilityRole="button"
      accessibilityLabel={`${result.admitted} in. ${money}. Scan next`}
    >
      <ScanResultHeading
        tone={colors.earned}
        sfSymbol="checkmark"
        ionicon="checkmark"
        title={`${result.admitted} in`}
        large
        lines={[`${result.guestName}, ${result.partyTitle}`, money]}
      />
    </PressableScale>
  );
}

/** No answer from the server. Nothing is assumed about what happened: "Try again" asks about the pass again. */
function OfflineResult({
  state,
  onRetry,
  onClose,
}: {
  state: Extract<ShownScanState, { phase: 'offline' }>;
  onRetry: Props['onRetry'];
  onClose: () => void;
}) {
  return (
    <View style={styles.content}>
      <ScanResultHeading
        tone={colors.surfaceHigh}
        iconColor={colors.label}
        titleColor={colors.label}
        sfSymbol="wifi.slash"
        ionicon="cloud-offline-outline"
        title="No connection"
        lines={[
          state.during === 'admit'
            ? 'The entry could not be confirmed. Try again to read the pass once more before letting anyone in.'
            : 'This pass could not be checked. Check your signal and try again.',
        ]}
      />
      <PrimaryButton label="Try again" onPress={() => onRetry(state.code, state.during)} loading={state.retrying} />
      <PrimaryButton label="Scan next" variant="secondary" onPress={onClose} disabled={state.retrying} />
    </View>
  );
}

/** The server said no: the reason, when the pass was first used if that is why, and on to the next guest. */
function RefusedResult({ error, onClose, onSignIn }: { error: unknown; onClose: () => void; onSignIn: () => void }) {
  const apiError = error instanceof ApiError ? error : null;
  const firstAt = apiError?.code === 'already_used' ? apiError.data?.firstCheckedInAt : null;
  const firstScanned = typeof firstAt === 'string' ? clock(firstAt) : '';
  const signedOut = apiError?.kind === 'signed_out';

  return (
    <View style={styles.content}>
      <ScanResultHeading
        tone={colors.danger}
        iconColor={colors.label}
        sfSymbol="xmark"
        ionicon="close"
        title={errorText(error)}
        lines={[firstScanned ? `First scanned at ${firstScanned}` : null]}
      />
      {signedOut ? <PrimaryButton label="Sign in" onPress={onSignIn} /> : <PrimaryButton label="Scan next" onPress={onClose} />}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.base,
  },
});
