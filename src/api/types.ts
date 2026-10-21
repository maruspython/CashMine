/** Wire types exactly as the API sends them. Amounts are decimal strings, never numbers. */

export type BalanceItem = {
  asset: string;
  decimals: number;
  available: string;
  pending: string;
  claiming: string;
  usdPrice: string;
};

export type BalancesResponse = {
  asOf: string;
  items: BalanceItem[];
};

export type ActivityItem = {
  id: string;
  type: 'accrual' | 'reversal' | 'claim';
  asset: string;
  amount: string;
  status: 'pending' | 'confirmed' | 'completed' | 'failed';
  exchange: string | null;
  createdAt: string;
  relatedId: string | null;
};

export type ActivityResponse = {
  items: ActivityItem[];
  nextCursor: string | null;
};

export type ClaimOptions = {
  asset: string;
  minAmount: string;
  fee: string;
  destinations: { id: string; label: string }[];
};

export type ClaimRequest = {
  asset: string;
  amount: string;
  destinationId: string;
};

export type Claim = {
  id: string;
  asset: string;
  amount: string;
  fee: string;
  receiveAmount: string;
  destinationId: string;
  status: 'pending' | 'completed' | 'failed';
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};
