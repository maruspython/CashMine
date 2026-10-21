import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError, errorMessage } from '@/api/client';
import { useBalances } from '@/balances/use-balances';
import { useClaimOptions } from '@/claims/claim-options';
import { useClaims } from '@/claims/claims-context';
import { isUnresolved } from '@/claims/local-claims';
import { maxAmountInput, validateClaimAmount } from '@/money/claim-amount';
import { formatUnits } from '@/money/decimal';
import { Button } from '@/ui/button';
import { DetailRow } from '@/ui/detail-row';
import { Notice } from '@/ui/notice';
import { Screen } from '@/ui/screen';
import { colors, inputFontSize } from '@/ui/theme';

/** What the user confirms. Fixed when they tap Review, so later edits cannot change it silently. */
type Review = { amount: string; fee: bigint; receive: bigint; destinationId: string; destinationLabel: string };

export default function ClaimScreen() {
  const { asset } = useLocalSearchParams<{ asset: string }>();
  const queryClient = useQueryClient();
  const balances = useBalances();
  const balance = balances.data?.items.find((item) => item.asset === asset);
  const options = useClaimOptions(asset, balance?.decimals);
  const { records, submit } = useClaims();

  const [input, setInput] = useState('');
  const [touched, setTouched] = useState(false);
  // No default: the user must choose where the money goes.
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const confirmingRef = useRef(false);

  const unresolved = records.find((r) => r.asset === asset && isUnresolved(r) && r.key !== submittingKey);
  if (unresolved) {
    return (
      <Screen>
        <Notice tone="warning" title="A claim is still being confirmed">
          Your claim of {unresolved.amount} {asset} may or may not have gone through yet. To avoid claiming twice, wait
          until it is confirmed.
        </Notice>
        <Button title="See claim status" onPress={() => router.replace(`/claims/${unresolved.key}`)} />
      </Screen>
    );
  }

  const opts = options.data;
  if (!balances.data || (balance && !opts)) {
    const loadError = balances.error ?? options.error;
    return (
      <Screen>
        {loadError ? (
          <>
            <Notice tone="error">Could not load claim details: {errorMessage(loadError)}</Notice>
            <Button
              title="Try again"
              onPress={() => {
                void balances.refetch();
                void options.refetch();
              }}
            />
          </>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </Screen>
    );
  }
  if (!balance || !opts) {
    return (
      <Screen>
        <Notice tone="error">There is no {asset} balance to claim.</Notice>
      </Screen>
    );
  }

  const { decimals, available } = balance;
  const limits = { decimals, available, minAmount: opts.minAmount, fee: opts.fee };
  const check = validateClaimAmount(input, limits);
  const unit = (units: bigint) => `${formatUnits(units, decimals)} ${asset}`;

  async function goToReview() {
    setError(null);
    setPreparing(true);
    const fresh = await options.refetch(); // the fee or destinations may have changed
    setPreparing(false);
    if (fresh.isError || !fresh.data) {
      setError(`Could not load the latest fee: ${errorMessage(fresh.error)}`);
      return;
    }
    const destination = fresh.data.destinations.find((d) => d.id === destinationId);
    if (!destination) {
      setDestinationId(null);
      setError('The destinations changed. Choose where the money goes again.');
      return;
    }
    const result = validateClaimAmount(input, { ...limits, minAmount: fresh.data.minAmount, fee: fresh.data.fee });
    if (!result.ok) {
      setTouched(true);
      return;
    }
    setReview({
      amount: result.wire,
      fee: result.fee,
      receive: result.receive,
      destinationId: destination.id,
      destinationLabel: destination.label,
    });
  }

  async function confirm() {
    if (!review || confirmingRef.current) {
      return; // a second tap must not send a second claim
    }
    confirmingRef.current = true;
    setError(null);
    const { key, firstAttempt } = submit({
      asset,
      amount: review.amount,
      destinationId: review.destinationId,
      destinationLabel: review.destinationLabel,
    });
    setSubmittingKey(key);
    const outcome = await firstAttempt;
    if (outcome.type !== 'rejected') {
      router.replace(`/claims/${key}`); // created, or unknown and still retrying in the background
      return;
    }
    confirmingRef.current = false;
    setSubmittingKey(null);
    // Refused, so nothing was claimed. Show why and reload what the rules depend on.
    if (outcome.error instanceof ApiError && outcome.error.code === 'UNAUTHORIZED') {
      return; // ClaimsProvider already sends the user to the token screen
    }
    setError(`Claim not sent: ${errorMessage(outcome.error)}`);
    setReview(null);
    void queryClient.invalidateQueries({ queryKey: ['balances'] });
    void queryClient.invalidateQueries({ queryKey: ['claim-options', asset] });
  }

  if (review) {
    return (
      <Screen>
        {error && <Notice tone="error">{error}</Notice>}
        <View style={styles.card}>
          <Text style={styles.label}>You claim</Text>
          <Text style={styles.bigAmount} selectable>
            {review.amount} {asset}
          </Text>
          <Text style={[styles.label, styles.gapAbove]}>Money goes to</Text>
          <Text style={styles.destinationBig}>{review.destinationLabel}</Text>
        </View>
        <View style={styles.card}>
          <DetailRow label="Fee" value={unit(review.fee)} />
          <DetailRow label="You receive" value={unit(review.receive)} strong />
        </View>
        <Text style={styles.muted}>The fee is taken from the amount. A claim cannot be cancelled.</Text>
        <Button title="Confirm claim" onPress={confirm} loading={submittingKey !== null} />
        <Button title="Edit" variant="secondary" onPress={() => setReview(null)} disabled={submittingKey !== null} />
      </Screen>
    );
  }

  const canClaim = available >= opts.minAmount && available > opts.fee;
  const showError = !check.ok && check.error !== 'empty' && (touched || check.error !== 'format');

  return (
    <Screen>
      {error && <Notice tone="error">{error}</Notice>}
      <View style={styles.card}>
        <DetailRow label="Available" value={unit(available)} strong />
        <DetailRow label="Minimum claim" value={unit(opts.minAmount)} />
        <DetailRow label="Fee" value={unit(opts.fee)} />
      </View>

      {!canClaim ? (
        <Notice tone="info">
          You can claim once you have at least {unit(opts.minAmount)} available, and more than the fee.
        </Notice>
      ) : (
        <>
          <Text style={styles.heading}>Amount</Text>
          <View style={styles.amountRow}>
            <TextInput
              value={input}
              onChangeText={(text) => {
                setInput(text);
                setError(null);
              }}
              onBlur={() => setTouched(true)}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              inputMode="decimal"
              autoCorrect={false}
              accessibilityLabel={`Amount in ${asset}`}
              style={styles.input}
            />
            <Button
              title="Max"
              variant="secondary"
              onPress={() => {
                setInput(maxAmountInput(limits));
                setTouched(true);
                setError(null);
              }}
            />
          </View>
          {showError && !check.ok && <Text style={styles.error}>{check.message}</Text>}
          {check.ok && (
            <View style={styles.card}>
              <DetailRow label="Fee" value={unit(check.fee)} />
              <DetailRow label="You receive" value={unit(check.receive)} strong />
            </View>
          )}

          <Text style={styles.heading}>Send to</Text>
          {opts.destinations.map((destination) => {
            const selected = destination.id === destinationId;
            return (
              <Pressable
                key={destination.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setDestinationId(destination.id)}
                style={[styles.destination, selected && styles.destinationSelected]}>
                <View style={[styles.radio, selected && styles.radioSelected]} />
                <Text style={styles.destinationText}>{destination.label}</Text>
              </Pressable>
            );
          })}
          {opts.destinations.length === 0 && <Notice tone="error">There is nowhere to send this claim.</Notice>}
          {destinationId === null && opts.destinations.length > 0 && (
            <Text style={styles.muted}>Choose where the money goes.</Text>
          )}

          <Button title="Review" onPress={goToReview} disabled={!check.ok || destinationId === null} loading={preparing} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: 48,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  heading: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  label: {
    fontSize: 14,
    color: colors.muted,
  },
  gapAbove: {
    marginTop: 8,
  },
  muted: {
    fontSize: 14,
    color: colors.muted,
  },
  bigAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  destinationBig: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontSize: inputFontSize,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  error: {
    fontSize: 14,
    color: colors.danger,
  },
  destination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  destinationSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.muted,
  },
  radioSelected: {
    borderColor: colors.primary,
    borderWidth: 6,
  },
  destinationText: {
    flexShrink: 1,
    fontSize: 16,
    color: colors.text,
  },
});
