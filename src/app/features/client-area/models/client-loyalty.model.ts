/** "Meus pontos" (Fase 5): o que a API devolve para o cliente logado. Sem niveis. */
export type ClientLoyaltyMode = 'PerReal' | 'PerService';
export type ClientLoyaltyRewardType = 'FreeService' | 'Other';
export type ClientLoyaltyRedemptionStatus = 'Requested' | 'Delivered' | 'Rejected' | 'Cancelled';

export interface ClientLoyaltyReward {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  type: ClientLoyaltyRewardType;
  serviceName: string | null;
  /** Por que nao da para pedir agora (ex.: servico indisponivel). */
  unavailable: string | null;
}

export interface ClientLoyaltyRedemption {
  id: string;
  rewardName: string;
  rewardType: ClientLoyaltyRewardType;
  pointsCost: number;
  status: ClientLoyaltyRedemptionStatus;
  requestedAtUtc: string;
  resolvedAtUtc: string | null;
  rejectionReason: string | null;
  appointmentStartDateTime: string | null;
  canCancel: boolean;
}

export interface ClientLoyaltyTransaction {
  id: string;
  occurredAtUtc: string;
  points: number;
  description: string;
  reason: string | null;
}

export interface ClientLoyalty {
  programEnabled: boolean;
  balance: number;
  mode: ClientLoyaltyMode;
  pointsPerReal: number;
  servicePoints: { serviceName: string; points: number }[];
  rewards: ClientLoyaltyReward[];
  redemptions: ClientLoyaltyRedemption[];
  totalTransactions: number;
  transactions: ClientLoyaltyTransaction[];
}

/** O que o menu e o Inicio precisam: se o programa esta ligado e o saldo. */
export interface ClientLoyaltySummary {
  programEnabled: boolean;
  balance: number;
}
