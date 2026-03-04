export interface Patient {
  id: string;
  phone: string;
  name: string | null;
  cpf?: string;
  birthDate: Date | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}
