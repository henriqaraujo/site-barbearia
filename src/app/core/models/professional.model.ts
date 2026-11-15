export interface Professional {
  readonly id: string;
  readonly name: string;
  readonly specialty: string;
  readonly description: string;
  readonly yearsOfExperience: number;
  readonly photoUrl: string | null;
  readonly socialNetworks: readonly string[];
}
