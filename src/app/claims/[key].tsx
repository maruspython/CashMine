import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { getClaim } from '@/api/endpoints';
import { useApiToken } from '@/auth/token-context';
import { useClaims } from '@/claims/claims-context';
import { Button } from '@/ui/button';
import { DetailRow } from '@/ui/detail-row';
import { Notice } from '@/ui/notice';
import { Screen } from '@/ui/screen';
import { colors } from '@/ui/theme';

export default function ClaimStatusScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const token = useApiToken();
  const { records, isSending, retry } = useClaims();
  const record = records.find((r) => r.key === key);
  const claimId = record?.claim?.id ?? '';
  // Read-only view of the polling that ClaimsProvider runs for pending claims.
  const poll = useQuery({
    queryKey: ['claim', claimId],
    queryFn: ({ signal }) => getClaim(token, claimId, signal),
    enabled: false,
  });
  const home = <Button title="Back to balances" variant="secondary" onPress={() => router.dismissTo('/')} />;

  if (!record) {
    return (
      <Screen>
        <Notice tone="info">This claim was not made on this device. Its result shows in your balances.</Notice>
        {home}
      </Screen>
    );
  }

  const { claim } = record;

  return (
    <Screen>
      {record.rejected !== null ? (
        <Notice tone="error" title="Claim not sent">
          {`${record.rejected}\nNothing was claimed.`}
        </Notice>
      ) : claim === null ? (
        isSending(record.key) ? (
          <View style={styles.waiting}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.title}>Sending your claim…</Text>
            <Text style={styles.text}>
              We are confirming it with the server. Do not claim again: you will not be charged twice.
            </Text>
          </View>
        ) : (
          <>
            <Notice tone="warning" title="We could not confirm your claim yet">
              It may or may not have gone through. Do not claim again. Tap Check again: it asks about this same claim
              and can never create a second one.
            </Notice>
            <Button title="Check again" onPress={() => retry(record.key)} />
          </>
        )
      ) : claim.status === 'pending' ? (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.title}>Claim pending</Text>
          <Text style={styles.text}>This usually takes about 20 seconds.</Text>
        </View>
      ) : claim.status === 'completed' ? (
        <Notice tone="success" title="Claim completed">
          {claim.receiveAmount} {claim.asset} was sent to {record.destinationLabel}.
        </Notice>
      ) : (
        <Notice tone="error" title="Claim failed">
          {`Reason: ${claim.failureReason ?? 'not given'}\nThe amount is back in your available balance.`}
        </Notice>
      )}

      {claim?.status === 'pending' && poll.isError && (
        <Notice tone="warning">Could not check the status: {errorMessage(poll.error)} Still trying.</Notice>
      )}

      <View style={styles.card}>
        <DetailRow label="You claim" value={`${claim?.amount ?? record.amount} ${record.asset}`} strong />
        {claim && <DetailRow label="Fee" value={`${claim.fee} ${claim.asset}`} />}
        {claim && <DetailRow label="You receive" value={`${claim.receiveAmount} ${claim.asset}`} strong />}
        <DetailRow label="To" value={record.destinationLabel} />
        {claim && <DetailRow label="Claim ID" value={claim.id} />}
      </View>

      {home}
    </Screen>
  );
}

const styles = StyleSheet.create({
  waiting: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  text: {
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
});
