export interface BarberService {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly duration: string;
  readonly durationMinutes: number;
  readonly price: number;
  readonly imageUrl: string;
}
