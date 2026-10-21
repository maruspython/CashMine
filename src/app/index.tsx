import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { AssetCard } from '@/balances/asset-card';
import { portfolioUsd } from '@/balances/balances';
import { useAdjustedBalances } from '@/balances/use-balances';
import { RecentClaims } from '@/claims/recent-claims';
import { formatUsd } from '@/money/usd';
import { Button } from '@/ui/button';
import { Screen } from '@/ui/screen';
import { colors } from '@/ui/theme';
import { formatAge, useNow } from '@/ui/time';

export default function Home() {
  const { data, adjusted, error, isFetching, refetch } = useAdjustedBalances();
  const now = useNow(1000);
  const changeToken = <Button title="Change API token" variant="secondary" onPress={() => router.push('/token')} />;

  if (!data) {
    return (
      <Screen>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Could not load balances: {errorMessage(error)}</Text>
            <Button title="Try again" onPress={() => refetch()} loading={isFetching} />
          </View>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.muted}>Loading balances…</Text>
          </View>
        )}
        {changeToken}
      </Screen>
    );
  }

  const usd = portfolioUsd(data.items);

  return (
    <Screen>
      <View style={styles.summary}>
        <Text style={styles.muted}>Total incl. pending</Text>
        <Text style={styles.total}>≈ {formatUsd(usd.totalInclPending)}</Text>
        <Text style={styles.text}>≈ {formatUsd(usd.available)} available to claim</Text>
        <View style={styles.freshness}>
          <Text style={styles.muted}>Updated {formatAge(data.asOf, now)}</Text>
          <Button title="Refresh" variant="secondary" onPress={() => refetch()} loading={isFetching} />
        </View>
        {adjusted && (
          <Text style={styles.muted}>Includes your latest claim. The server data will show it within 15 s.</Text>
        )}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            Showing data from {formatAge(data.asOf, now)}. Could not refresh: {errorMessage(error)}
          </Text>
        </View>
      )}

      <RecentClaims now={now} />

      {data.items.length === 0 ? (
        <Text style={styles.muted}>No payback yet.</Text>
      ) : (
        data.items.map((balance) => <AssetCard key={balance.asset} balance={balance} />)
      )}

      {changeToken}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  total: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  text: {
    fontSize: 15,
    color: colors.text,
  },
  muted: {
    fontSize: 14,
    color: colors.muted,
  },
  freshness: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loading: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  errorBox: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: colors.danger,
  },
});
