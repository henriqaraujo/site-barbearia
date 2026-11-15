import { Professional } from '../../../core/models/professional.model';
import { PublicSubscriptionBenefitCoverage, PublicSubscriptionCoveringProfessionals, PublicUsableRedemption } from '../../../core/models/public-booking-api.model';
import { formatDayMonth } from '../../../core/utils/date-label.util';
import { joinNames } from '../../../core/utils/plan-professionals.util';

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** O profissional atende pelo plano do cliente (selo "Pelo seu plano" na lista). */
export function isCoveredByPlan(professionalId: string, planProfessionalIds: ReadonlySet<string> | 'any' | null): boolean {
  return planProfessionalIds === 'any' || (planProfessionalIds instanceof Set && planProfessionalIds.has(professionalId));
}

/** Profissionais que atendem pelo plano primeiro, mantendo a ordem da API entre eles. */
export function sortPlanProfessionalsFirst(
  professionals: Professional[],
  planProfessionalIds: ReadonlySet<string> | 'any' | null
): Professional[] {
  if (!(planProfessionalIds instanceof Set)) {
    return professionals;
  }

  return [...professionals].sort((first, second) =>
    Number(isCoveredByPlan(second.id, planProfessionalIds)) - Number(isCoveredByPlan(first.id, planProfessionalIds))
  );
}

/**
 * Cliente com plano cujo horario escolhido nao e coberto: o motivo e o valor que sera cobrado, mostrados antes de
 * confirmar. Null quando coberto, sem plano para o servico ou ainda sem consulta.
 */
export function getUncoveredWarning(
  coverage: PublicSubscriptionBenefitCoverage | null,
  servicePrice: number | null
): { reason: string; chargeLabel: string } | null {
  if (!coverage || coverage.isCovered || !coverage.planName || !coverage.uncoveredReason || servicePrice === null) {
    return null;
  }

  const planName = coverage.planName;
  const reason = coverage.uncoveredReason === 'Overdue'
    ? `Sua mensalidade de ${formatDayMonth(coverage.overdueInstallmentDate)} do ${planName} está em aberto. Enquanto ela não for paga, o plano não cobre; o pagamento é feito no estabelecimento.`
    : coverage.uncoveredReason === 'LimitReached'
      ? `Os usos do ${planName} para este serviço acabaram neste período.`
      : coverage.uncoveredReason === 'OutsideCycle'
        ? `A data fica fora do período do ${planName}.`
        : coverage.exclusiveProfessionalName
          ? `O ${planName} é atendido só por ${coverage.exclusiveProfessionalName}.`
          : coverage.allowedProfessionalNames?.length
            ? `O ${planName} é atendido por ${joinNames(coverage.allowedProfessionalNames)}.`
            : `Este profissional não atende pelo ${planName}.`;

  return { reason, chargeLabel: BRL_FORMATTER.format(servicePrice) };
}

/** Converte a resposta da API de cobertura de profissionais para o estado visual do plano. */
export function resolvePlanCoverageState(
  covering: PublicSubscriptionCoveringProfessionals | null
): { planName: string | null; planProfessionalIds: ReadonlySet<string> | 'any' | null } {
  if (!covering?.hasPlan) {
    return { planName: null, planProfessionalIds: null };
  }

  return {
    planName: covering.planName,
    planProfessionalIds: covering.professionalIds === null ? 'any' : new Set(covering.professionalIds)
  };
}

/** Plano ou resgate: o horario sai sem custo. */
export function isFreeOfCharge(useSubscriptionBenefit: boolean, selectedRedemption: PublicUsableRedemption | null): boolean {
  return useSubscriptionBenefit || Boolean(selectedRedemption);
}
