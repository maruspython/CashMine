import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { formatUnits } from '@/money/decimal';
import { formatUsd, toUsd } from '@/money/usd';
import { Button } from '@/ui/button';
import { DetailRow } from '@/ui/detail-row';
import { colors } from '@/ui/theme';

import { assetTotal, Balance } from './balances';

export function AssetCard({ balance }: { balance: Balance }) {
  const { asset, decimals } = balance;
  const usd = toUsd({ units: assetTotal(balance), decimals, usdPrice: balance.usdPrice });
  const amount = (units: bigint) => `${formatUnits(units, decimals)} ${asset}`;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.asset}>{asset}</Text>
        <Text style={styles.usd}>≈ {formatUsd(usd)}</Text>
      </View>
      <DetailRow label="Available" value={amount(balance.available)} strong />
      {balance.pending > 0n && <DetailRow label="Pending" value={amount(balance.pending)} />}
      {balance.claiming > 0n && <DetailRow label="Claiming" value={amount(balance.claiming)} />}
      <Button title={`Claim ${asset}`} variant="secondary" onPress={() => router.push(`/claim/${asset}`)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  asset: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  usd: {
    fontSize: 15,
    color: colors.muted,
  },
});
