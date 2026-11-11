import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AdminScreen } from '@/components/admin/admin-screen';
import { LineupEditor } from '@/components/admin/lineup-editor';
import { ModalFormHeader } from '@/components/admin/modal-form-header';
import { PartyFormFields } from '@/components/admin/party-form';
import { checkDraft, draftFromParty, toActs, toPartyInput, type ActDraft } from '@/components/admin/party-input';
import { usePartyForm } from '@/components/admin/use-party-form';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { dayAndTime } from '@/components/host/format';
import { resolveMediaUrl } from '@/constants/api';
import { keys, useHostParties, useSetActs } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { partyService } from '@/services/partyService';
import { colors, spacing, typography } from '@/theme';
import type { HostParty } from '@/types/api';

/**
 * Edit a party, opened from the Parties tab. A draft can change everything; a published party that has
 * not ended can change its line-up only (`PUT /api/parties/{id}/acts`).
 */
export default function EditPartyScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const parties = useHostParties();
  const party = parties.data?.find((p) => p.id === partyId) ?? null;

  if (!party) {
    let body: React.ReactNode;
    if (parties.isPending) body = <Loading />;
    else if (!parties.data) body = <Failed error={parties.error} onRetry={() => parties.refetch()} />;
    else body = <Empty title="This party is gone" body="It may have been deleted. Go back to Parties." />;
    return (
      <View style={styles.root}>
        <ModalFormHeader title="Edit party" postLabel="Save" onCancel={() => router.back()} onPost={() => router.back()} submitting={false} />
        <AdminScreen>{body}</AdminScreen>
      </View>
    );
  }

  if (party.status === 'Draft') return <EditDraft party={party} />;
  if ((party.status === 'Published' || party.status === 'SoldOut') && Date.now() < new Date(party.endsAt).getTime()) {
    return <EditLineup party={party} />;
  }
  return (
    <View style={styles.root}>
      <ModalFormHeader title="Edit party" postLabel="Save" onCancel={() => router.back()} onPost={() => router.back()} submitting={false} />
      <AdminScreen>
        <Empty title="This party cannot be changed" body="It has ended or was cancelled." />
      </AdminScreen>
    </View>
  );
}

function EditDraft({ party }: { party: HostParty }) {
  const client = useQueryClient();
  const form = usePartyForm(party, resolveMediaUrl(party.imageUrl) ?? null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const save = async () => {
    setSubmitError(null);
    if (!form.validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    try {
      // The form has no place field: the party stays where it is.
      await partyService.updateParty(party.id, toPartyInput(form.draft, party));
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSubmitError(errorText(error));
      setSaving(false);
      return;
    }

    let coverProblem: string | null = null;
    if (form.imageUri) {
      try {
        await partyService.uploadPartyImage(party.id, form.imageUri);
      } catch (error) {
        coverProblem = `The new cover was not uploaded. ${errorText(error)}`;
      }
    }

    await client.invalidateQueries({ queryKey: keys.hostParties });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({ pathname: '/admin/manage', params: { updatedPartyId: party.id } });
    if (coverProblem) Alert.alert('Changes saved', coverProblem);
  };

  return (
    <View style={styles.root}>
      <ModalFormHeader title="Edit party" postLabel="Save" onCancel={() => router.back()} onPost={save} submitting={saving} />
      <AdminScreen>
        <PartyFormFields form={form} />
        {submitError ? (
          <Animated.Text entering={FadeIn.duration(200)} style={styles.submitError} accessibilityLiveRegion="polite">
            {submitError}
          </Animated.Text>
        ) : null}
      </AdminScreen>
    </View>
  );
}

/** A published party: only the line-up can change. */
function EditLineup({ party }: { party: HostParty }) {
  const counter = useRef(0);
  const newKey = () => `act-${++counter.current}`;
  const [draft, setDraft] = useState(() => draftFromParty(party, newKey, new Date()));
  const [error, setError] = useState<string | undefined>(undefined);
  const setActs = useSetActs();

  const onChange = (acts: ActDraft[]) => {
    setDraft((prev) => ({ ...prev, acts }));
    setError(undefined);
  };

  const save = async () => {
    const found = checkDraft(draft).acts;
    if (found) {
      setError(found);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    try {
      await setActs.mutateAsync({ partyId: party.id, acts: toActs(draft) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/admin/manage', params: { updatedPartyId: party.id } });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(errorText(e));
    }
  };

  return (
    <View style={styles.root}>
      <ModalFormHeader title="Line-up" postLabel="Save" onCancel={() => router.back()} onPost={save} submitting={setActs.isPending} />
      <AdminScreen>
        <View style={styles.heading}>
          <Display size="md" numberOfLines={2}>
            {party.title}
          </Display>
          <Text style={styles.sub}>{dayAndTime(party.startsAt)}. Published, so only the line-up can change.</Text>
        </View>
        <LineupEditor acts={draft.acts} partyStart={draft.start} error={error} onChange={onChange} newKey={newKey} />
      </AdminScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  heading: {
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  sub: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  submitError: {
    ...typography.footnote,
    color: colors.danger,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
});
