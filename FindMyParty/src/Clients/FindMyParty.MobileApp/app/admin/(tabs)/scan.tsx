import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeSettings } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { confirmSignOut } from '@/components/host/account-rows';
import { DoorTopBar } from '@/components/host/door/door-top-bar';
import { RefusedBanner } from '@/components/host/door/refused-banner';
import { useDoorList } from '@/components/host/door/use-door-list';
import { useDoorQueue } from '@/components/host/door/use-door-queue';
import { ScanResultSheet } from '@/components/host/scan-result-sheet';
import { ScanReticle } from '@/components/host/scan-reticle';
import { useDoorScan } from '@/components/host/use-door-scan';
import { useHostGate } from '@/components/host/use-host-gate';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useMe } from '@/hooks/queries';
import { pendingAdmits, refusedBanner } from '@/services/doorQueue';
import { colors, layout, radii, spacing, typography } from '@/theme';

const BARCODES: BarcodeSettings = { barcodeTypes: ['qr'] };

/** The Scan tab (S-21): the door. A Host, an Admin or a door login gets the camera. */
export default function HostScanTab() {
  const allowed = useHostGate({ allowDoor: true });

  if (!allowed) {
    return (
      <View style={styles.root}>
        <Loading />
      </View>
    );
  }
  return <DoorScanner />;
}

function DoorScanner() {
  const focused = useIsFocused();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const granted = permission?.granted === true;

  // Coming back from Settings: read the permission again.
  useEffect(() => {
    if (granted) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') getPermission();
    });
    return () => sub.remove();
  }, [granted, getPermission]);

  if (!permission) {
    return (
      <View style={styles.root}>
        <Loading />
      </View>
    );
  }

  if (!granted) {
    return (
      <View style={[styles.root, styles.explain]}>
        <Display size="md" accessibilityRole="header">
          Scan passes
        </Display>
        <Text style={styles.explainBody}>The camera reads passes at the door.</Text>
        {permission.canAskAgain ? (
          <PrimaryButton label="Allow the camera" onPress={() => requestPermission()} />
        ) : (
          <>
            <Text style={styles.explainBody}>Camera access is off for FindMyParty. Turn it on in Settings to scan.</Text>
            <PrimaryButton label="Open Settings" onPress={() => Linking.openSettings()} />
          </>
        )}
      </View>
    );
  }

  return <Scanner focused={focused} />;
}

function Scanner({ focused }: { focused: boolean }) {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const roles = me.data?.roles ?? [];
  // A door login has no tab bar (see the tabs layout) and signs out from here.
  const doorOnly = roles.includes('Door') && !roles.includes('Host') && !roles.includes('Admin');

  const queue = useDoorQueue();
  const { door, list } = useDoorList();
  const { state, onScanned, admit, reset } = useDoorScan({ queue, list });
  const [torch, setTorch] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // A fresh list has the entries confirmed well before it: stop counting those on the phone.
  const { listArrived } = queue;
  const listParty = list?.manifest.partyId;
  const listTime = list?.receivedAt;
  useEffect(() => {
    if (listParty && listTime) listArrived(listParty, listTime);
  }, [listParty, listTime, listArrived]);

  // Leaving the tab switches the torch off; the camera itself is unmounted below.
  useFocusEffect(
    useCallback(() => {
      return () => setTorch(false);
    }, []),
  );

  const handleBarcode = useCallback(
    (result: BarcodeScanningResult) => {
      if (result.data) onScanned(result.data);
    },
    [onScanned],
  );

  const checking = state.phase === 'checking';
  const partyId = door?.party?.id;
  const queuedAdmits = partyId ? pendingAdmits(queue.queue, partyId) : 0;
  const banner = refusedBanner(queue.queue.refused);
  const bottomClear = doorOnly
    ? insets.bottom + spacing.base
    : insets.bottom + layout.floatingTabBarHeight + layout.floatingTabBarBottomOffset + spacing.base;

  return (
    <View style={styles.root}>
      {focused && !cameraError ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={BARCODES}
          // The camera reports the same code many times a second; nothing is read while a result is up.
          onBarcodeScanned={state.phase === 'idle' && queue.ready ? handleBarcode : undefined}
          onMountError={(event) => setCameraError(event.message)}
        />
      ) : null}

      <View style={[styles.overlay, { paddingTop: insets.top + spacing.sm, paddingBottom: bottomClear }]} pointerEvents="box-none">
        <View style={styles.topArea} pointerEvents="box-none">
          <DoorTopBar door={door} queuedAdmits={queuedAdmits} waiting={queue.queue.pending.length} />
          {banner ? <RefusedBanner text={banner} onDismiss={queue.dismissRefused} /> : null}
        </View>

        <View style={styles.middle} pointerEvents="none">
          {cameraError ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>The camera could not start.</Text>
              <Text style={styles.hint}>{cameraError}</Text>
            </View>
          ) : (
            <>
              <ScanReticle />
              <View style={[styles.block, styles.hintBlock]} accessibilityLiveRegion="polite">
                {checking ? <ActivityIndicator size="small" color={colors.label} /> : null}
                <Text style={styles.hint}>{checking ? 'Checking the pass' : "Hold a guest's pass inside the corners"}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.bottom} pointerEvents="box-none">
          {doorOnly ? (
            <PressableScale onPress={confirmSignOut} style={styles.signOut} accessibilityRole="button" accessibilityLabel="Sign out">
              <Text style={styles.blockLabel}>Sign out</Text>
            </PressableScale>
          ) : (
            <View />
          )}
          {cameraError ? null : (
            <PressableScale
              onPress={() => setTorch((on) => !on)}
              style={[styles.torch, torch && styles.torchOn]}
              accessibilityRole="button"
              accessibilityLabel={torch ? 'Turn the torch off' : 'Turn the torch on'}
              accessibilityState={{ selected: torch }}
            >
              <Icon
                sfSymbol={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'}
                ionicon={torch ? 'flashlight' : 'flashlight-outline'}
                size={20}
                color={torch ? colors.ink : colors.label}
              />
            </PressableScale>
          )}
        </View>
      </View>

      <ScanResultSheet state={state} focused={focused} onAdmit={admit} onDismissed={reset} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  explain: {
    justifyContent: 'center',
    paddingHorizontal: layout.screenMargin,
    gap: spacing.base,
  },
  explainBody: {
    ...typography.body,
    color: colors.labelSecondary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: spacing.base,
  },
  topArea: {
    gap: spacing.md,
  },
  block: {
    flexShrink: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  blockLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  hintBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hint: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signOut: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
  },
  torch: {
    width: 48,
    height: 48,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchOn: {
    backgroundColor: colors.label,
  },
});
