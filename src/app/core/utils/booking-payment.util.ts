export interface PaymentSimulation {
  readonly paymentMode: 'establishment' | 'deposit';
  readonly depositAmount: number;
  readonly message: string;
}

/** Calcula o sinal de 20% para serviços que futuramente exigirem reserva antecipada. */
export function calculateDepositAmount(servicePrice: number): number {
  return Number((servicePrice * 0.2).toFixed(2));
}

/** Define a regra demonstrativa de pagamento sem integrar gateway real nesta etapa. */
export function getPaymentSimulation(servicePrice: number): PaymentSimulation {
  if (servicePrice >= 150) {
    return {
      paymentMode: 'deposit',
      depositAmount: calculateDepositAmount(servicePrice),
      message: 'Sinal sugerido de 20% para garantir a reserva.'
    };
  }

  return {
    paymentMode: 'establishment',
    depositAmount: 0,
    message: 'Pagamento realizado no estabelecimento.'
  };
}
