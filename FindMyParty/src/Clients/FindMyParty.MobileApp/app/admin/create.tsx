import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { AdminScreen } from '@/components/admin/admin-screen';
import { ModalFormHeader } from '@/components/admin/modal-form-header';
import { PartyFormFields, usePartyForm } from '@/components/admin/party-form';
import { PrimaryButton } from '@/components/ui/primary-button';
import { partyService } from '@/services/partyService';
import { adminService } from '@/services/adminService';
import type { CreatePartyRequest } from '@/types/parties';
import type { HostProfile } from '@/types/auth';
import { colors, spacing, typography } from '@/theme';

export default function CreatePartyScreen() {
  // Venue profile (coordinates fetched silently on mount; no role gate here —
  // the modal is only reachable from the already-gated tab area).
  const [hostProfile, setHostProfile] = useState<HostProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminService.getHostProfile().then((profile) => {
      if (!cancelled && profile) setHostProfile(profile);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const form = usePartyForm();

  // Submission + inline messaging owned by the screen.
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (publish: boolean) => {
    setSubmitError(null);
    Haptics.selectionAsync();

    if (!form.validate()) return;

    if (!hostProfile) {
      setSubmitError('Venue profile still loading — try again in a moment.');
      return;
    }

    const payload = form.buildPayload();

    setLoading(true);
    try {
      const request: CreatePartyRequest = {
        ...payload,
        latitude: hostProfile.latitude,
        longitude: hostProfile.longitude,
      };

      const partyId = await partyService.createParty(request);
      if (!partyId) {
        setSubmitError("Couldn't create your party. Check your connection and try again.");
        setLoading(false);
        return;
      }

      // Upload the cover image if one was chosen. A failure here is non-blocking:
      // the party exists, so we surface an inline notice and still proceed.
      if (form.values.imageUri) {
        const imageUrl = await partyService.uploadPartyImage(partyId, form.values.imageUri);
        if (!imageUrl) {
          form.setImageNotice(
            "Party created, but the cover image didn't upload. You can add it later from Manage.",
          );
        }
      }

      if (publish) {
        const published = await partyService.publishParty(partyId);
        if (!published) {
          // Created but not published — land on Manage so the host can publish there.
          form.setImageNotice("Saved as draft — couldn't publish. Publish it from Manage.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // TODO(animation-specialist): the `newPartyId` param drives the new-party
          // pulse on Manage (#6).
          router.replace({ pathname: '/admin/manage', params: { newPartyId: partyId } });
          return;
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // TODO(animation-specialist): the `newPartyId` param drives the new-party
      // pulse on Manage (#6).
      router.replace({ pathname: '/admin/manage', params: { newPartyId: partyId } });
    } catch {
      setSubmitError("Couldn't create your party. Check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ModalFormHeader
        title="New Party"
        onCancel={() => router.back()}
        onPost={() => handleSubmit(true)}
        submitting={loading}
      />

      <AdminScreen>
        <PartyFormFields {...form.fieldProps} />

        {/* ─── Footer ─── */}
        {submitError ? (
          <Animated.Text
            entering={FadeIn.duration(200)}
            style={styles.submitError}
            accessibilityLiveRegion="polite"
          >
            {submitError}
          </Animated.Text>
        ) : null}
        <View style={styles.footer}>
          <PrimaryButton
            label="Save to Drafts"
            variant="secondary"
            onPress={() => handleSubmit(false)}
            loading={loading}
            disabled={loading}
            accessibilityHint="Saves this party as a draft without publishing"
          />
        </View>
      </AdminScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  submitError: {
    ...typography.footnote,
    color: colors.danger,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  footer: {
    marginTop: spacing.sm,
  },
});
