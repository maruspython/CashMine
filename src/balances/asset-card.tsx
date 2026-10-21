import { StyleSheet, Text, View } from 'react-native';

import { formatUnits } from '@/money/decimal';
import { formatUsd, toUsd } from '@/money/usd';
import { colors } from '@/ui/theme';

import { assetTotal, Balance } from './balances';

export function AssetCard({ balance }: { balance: Balance }) {
  const { asset, decimals } = balance;
  const usd = toUsd({ units: assetTotal(balance), decimals, usdPrice: balance.usdPrice });
  const amount = (units: bigint) => `${formatUnits(units, decimals)} ${asset}`;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.asset}>{asset}</Text>
        <Text style={styles.usd}>≈ {formatUsd(usd)}</Text>
      </View>
      <Line label="Available" value={amount(balance.available)} strong />
      {balance.pending > 0n && <Line label="Pending" value={amount(balance.pending)} />}
      {balance.claiming > 0n && <Line label="Claiming" value={amount(balance.claiming)} />}
    </View>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, strong && styles.strong]} selectable>
        {value}
      </Text>
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
  row: {
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
  label: {
    fontSize: 15,
    color: colors.muted,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 15,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  strong: {
    fontWeight: '600',
  },
});
