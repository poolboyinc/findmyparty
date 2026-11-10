import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AdminScreen } from '@/components/admin/admin-screen';
import { ModalFormHeader } from '@/components/admin/modal-form-header';
import { PartyFormFields, usePartyForm } from '@/components/admin/party-form';
import { EmptyState } from '@/components/ui/empty-state';
import { keys } from '@/hooks/queries';
import { partyService } from '@/services/partyService';
import { takeEditDraft } from '@/hooks/useEditPartyDraft';
import { resolveMediaUrl } from '@/constants/api';
import type { HostParty } from '@/types/api';
import type { UpdatePartyRequest } from '@/types/parties';
import { colors, spacing, typography } from '@/theme';

/** Edit is reachable for Draft parties only. */
function isDraft(party: HostParty): boolean {
  return party.status?.toLowerCase() === 'draft';
}

export default function EditPartyScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();

  // Consume the handed-off draft exactly once on mount. Held in state so a
  // re-render never re-takes (the store self-clears on take).
  const [draft] = useState<HostParty | null>(() => takeEditDraft());

  // Defensive: empty store or a non-draft party means we arrived without a valid
  // handoff — bounce back after surfacing the reason.
  const invalid = !draft || !isDraft(draft);

  useEffect(() => {
    if (invalid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [invalid]);

  if (invalid) {
    return (
      <View style={styles.root}>
        <ModalFormHeader
          title="Edit party"
          postLabel="Save"
          onCancel={() => router.back()}
          onPost={() => router.back()}
          submitting={false}
        />
        <AdminScreen>
          <EmptyState
            sfSymbol="exclamationmark.triangle"
            ionicon="alert-circle-outline"
            title="Can't edit this party"
            body="Only drafts can be edited. Go back to Parties and try again."
            action={{ label: 'Go back', onPress: () => router.back() }}
          />
        </AdminScreen>
      </View>
    );
  }

  return <EditPartyForm partyId={partyId} draft={draft} />;
}

function EditPartyForm({ partyId, draft }: { partyId: string; draft: HostParty }) {
  const client = useQueryClient();
  const form = usePartyForm({
    title: draft.title,
    description: draft.description,
    genre: draft.genre ?? undefined,
    performerType: draft.performerType ?? undefined,
    performerName: draft.performerName ?? undefined,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    price: draft.price,
    capacity: draft.capacity,
    imageUrl: resolveMediaUrl(draft.imageUrl),
  });

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitError(null);
    Haptics.selectionAsync();

    if (!form.validate()) return;

    const payload = form.buildPayload();

    setLoading(true);
    try {
      // Reuse the draft's coordinates — the form has no location field, and a
      // PATCH must keep lat/long intact. `imageUrl` is intentionally NOT sent;
      // the cover is updated only via the image-upload endpoint below.
      const request: UpdatePartyRequest = {
        ...payload,
        // Hosts cannot feature their own parties; the server ignores this field.
        // It is only here because the shared request type still lists it.
        featured: draft.featured,
        latitude: draft.latitude,
        longitude: draft.longitude,
      };

      const updated = await partyService.updateParty(partyId, request);
      if (!updated) {
        // Covers a backend InvalidState (e.g. no longer a draft) or any non-ok.
        setSubmitError("Couldn't save your changes. This party may no longer be a draft.");
        setLoading(false);
        return;
      }

      // Upload a new cover ONLY if the host picked one this session. A failure is
      // non-blocking: the edits saved, so surface an inline notice and proceed.
      if (form.hasNewImage && form.values.imageUri) {
        const imageUrl = await partyService.uploadPartyImage(partyId, form.values.imageUri);
        if (!imageUrl) {
          form.setImageNotice(
            "Changes saved, but the new cover image didn't upload. Try again from Parties.",
          );
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // The `updatedPartyId` param highlights the edited card in Parties.
      client.invalidateQueries({ queryKey: keys.hostParties });
      router.replace({ pathname: '/admin/manage', params: { updatedPartyId: partyId } });
    } catch {
      setSubmitError("Couldn't save your changes. Check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ModalFormHeader
        title="Edit party"
        postLabel="Save"
        onCancel={() => router.back()}
        onPost={handleSubmit}
        submitting={loading}
      />

      <AdminScreen>
        <PartyFormFields {...form.fieldProps} />

        {submitError ? (
          <Animated.Text
            entering={FadeIn.duration(200)}
            style={styles.submitError}
            accessibilityLiveRegion="polite"
          >
            {submitError}
          </Animated.Text>
        ) : null}
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
