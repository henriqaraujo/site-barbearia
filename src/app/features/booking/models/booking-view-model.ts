export interface BookingSummaryViewModel {
  readonly temporaryCode: string;
  readonly serviceName: string;
  readonly professionalName: string;
  readonly dateLabel: string;
  readonly time: string;
  readonly duration: string;
  readonly priceLabel: string;
  readonly paymentMessage: string;
  readonly depositLabel: string;
  readonly subscriptionLabel: string;
}
