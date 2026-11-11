import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AdminScreen } from '@/components/admin/admin-screen';
import { ModalFormHeader } from '@/components/admin/modal-form-header';
import { PartyFormFields } from '@/components/admin/party-form';
import { toPartyInput } from '@/components/admin/party-input';
import { usePartyForm } from '@/components/admin/use-party-form';
import { PrimaryButton } from '@/components/ui/primary-button';
import { keys, useHostVenue } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { partyService } from '@/services/partyService';
import { colors, spacing, typography } from '@/theme';

/** A new party: saved as a draft, or published at once from "Post". Opens as a modal over the Parties tab. */
export default function CreatePartyScreen() {
  // The party sits at the venue: its coordinates come from the venue profile.
  const venue = useHostVenue();
  const form = usePartyForm(null);
  const client = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const save = async (publish: boolean) => {
    setSubmitError(null);
    Haptics.selectionAsync();
    if (!form.validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!venue.data) {
      setSubmitError(venue.isError ? errorText(venue.error) : 'The venue is still loading. Try again in a moment.');
      if (venue.isError) venue.refetch();
      return;
    }

    setSaving(true);
    let partyId: string;
    try {
      partyId = await partyService.createParty(toPartyInput(form.draft, venue.data));
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSubmitError(errorText(error));
      setSaving(false);
      return;
    }

    // From here the party exists; what fails next is said, and the host lands on Parties either way.
    const problems: string[] = [];
    if (form.imageUri) {
      try {
        await partyService.uploadPartyImage(partyId, form.imageUri);
      } catch (error) {
        problems.push(`The cover was not uploaded. ${errorText(error)}`);
      }
    }
    if (publish) {
      try {
        await partyService.publishParty(partyId);
      } catch (error) {
        problems.push(`It was saved as a draft, not published. ${errorText(error)}`);
      }
    }

    await client.invalidateQueries({ queryKey: keys.hostParties });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({ pathname: '/admin/manage', params: { newPartyId: partyId } });
    if (problems.length > 0) Alert.alert('Party saved', problems.join('\n\n'));
  };

  return (
    <View style={styles.root}>
      <ModalFormHeader title="New party" onCancel={() => router.back()} onPost={() => save(true)} submitting={saving} />

      <AdminScreen>
        <PartyFormFields form={form} />

        {submitError ? (
          <Animated.Text entering={FadeIn.duration(200)} style={styles.submitError} accessibilityLiveRegion="polite">
            {submitError}
          </Animated.Text>
        ) : null}
        <PrimaryButton
          label="Save as draft"
          variant="secondary"
          onPress={() => save(false)}
          loading={saving}
          disabled={saving}
          accessibilityHint="Saves this party without publishing it"
        />
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
});
