/**
 * Tipos TypeScript baseados no Swagger do SysVortex
 */

export interface SysVortexPaciente {
  cpf: string;
  unidade?: number;
  nome?: string;
  dtnasc?: string; // YYYY-MM-DD
  sexo?: number;
  telefone?: string;
  celular?: string;
  email?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  complemento?: string;
}

export interface SysVortexAgenda {
  cpf_paciente: string;
  data_inicial: string; // YYYYMMDD
  data_final: string; // YYYYMMDD
  unidade?: number;
}

export interface SysVortexFinanceiro {
  cliente: string;
  token: string;
  tipoconexao: string;
  tipo: number; // 1=Entrada NF, 2=Faturamento
  pessoa?: SysVortexPessoa;
  dados_financeiro?: SysVortexFinDados[];
  plct?: SysVortexFinPlct[];
  cc?: SysVortexFinCC[];
  msg_retorno?: string;
}

export interface SysVortexPessoa {
  id?: number;
  nome?: string;
  social?: string;
  dtnasc?: string; // datetime
  sexo?: number;
  tipo_pessoa?: number;
  tele?: string;
  cel?: string;
  email?: string;
  rg?: string;
  orgem?: string;
  dt_emis_rg?: string;
  cpf?: string;
  im?: string;
  ct_traba?: string;
  ct_moto?: string;
  passap?: string;
  cep?: string;
  cidade?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  uf?: string;
  compl?: string;
  ibge?: number;
  pais?: number;
  cod_externo?: string;
}

export interface SysVortexFinDados {
  id?: number;
  id_externo?: number;
  unidade?: number;
  id_doc?: number;
  tp?: string;
  tpdoc?: number;
  doc?: string;
  pessoa?: number;
  histor?: string;
  parcela?: number;
  valor?: number;
  dtlanc?: string;
  dtvenc?: string;
  ctfinan?: number;
  obs?: string;
  condpag?: number;
  previsao?: boolean;
}

export interface SysVortexFinPlct {
  id?: number;
  id_fin?: number;
  id_fin_externo?: number;
  id_plct?: number;
  id_plct_externo?: string;
  valor?: number;
}

export interface SysVortexFinCC {
  id?: number;
  id_fin?: number;
  id_fin_externo?: number;
  id_cc?: number;
  id_cc_externo?: string;
  valor?: number;
}
