import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/ui/theme';

import { useClaims } from './claims-context';
import { isUnresolved, LocalClaim } from './local-claims';

/** Settled claims stay on Home this long, so a failure is not missed. */
const SHOW_SETTLED_MS = 10 * 60_000;

/** Claims from this device that are in progress or just settled. */
export function RecentClaims({ now }: { now: number }) {
  const { records } = useClaims();
  const visible = records.filter(
    (r) =>
      r.rejected === null &&
      (isUnresolved(r) || r.claim?.status === 'pending' || now - r.confirmedAt < SHOW_SETTLED_MS),
  );
  if (visible.length === 0) {
    return null;
  }
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Your claims</Text>
      {visible.map((record) => (
        <Pressable
          key={record.key}
          accessibilityRole="link"
          onPress={() => router.push(`/claims/${record.key}`)}
          style={styles.row}>
          <View style={styles.main}>
            <Text style={styles.amount}>
              {record.amount} {record.asset}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              to {record.destinationLabel}
            </Text>
          </View>
          <Text style={[styles.status, { color: statusColor(record) }]}>{statusText(record)} ›</Text>
        </Pressable>
      ))}
    </View>
  );
}

function statusText(record: LocalClaim): string {
  if (record.claim === null) return 'Confirming';
  if (record.claim.status === 'pending') return 'Pending';
  return record.claim.status === 'completed' ? 'Completed' : 'Failed';
}

function statusColor(record: LocalClaim): string {
  if (record.claim?.status === 'completed') return colors.success;
  if (record.claim?.status === 'failed') return colors.danger;
  return colors.warning;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  amount: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
  },
});
