/**
 * SysVortex API Adapter - Cliente TypeScript para API SysVortex
 * Baseado no swagger.json disponível
 */
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';
import type { SysVortexPaciente, SysVortexFinanceiro, SysVortexAgenda } from '../types/sysvortex.js';

export interface SysVortexConfig {
  baseURL: string;
  cliente: string;
  token: string;
  unidade: number;
  tipoconexao?: string;
}

export class SysVortexAdapter {
  private client: AxiosInstance;
  private config: SysVortexConfig;

  constructor(config: SysVortexConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: `${config.baseURL}/FAMBER/api`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000, // 30s
    });

    logger.info(`✅ SysVortex adapter inicializado: ${config.baseURL}`);
  }

  /**
   * Cria request padrão com autenticação
   */
  private createRequest(data: any = {}) {
    return {
      cliente: this.config.cliente,
      token: this.config.token,
      tipoconexao: this.config.tipoconexao || '',
      unidade: this.config.unidade,
      ...data,
    };
  }

  // ========== HOMECARE - PACIENTES ==========

  /**
   * Registra/atualiza paciente no SysVortex
   */
  async registrarPaciente(paciente: SysVortexPaciente) {
    try {
      const request = this.createRequest({
        cpf_paciente: paciente.cpf,
        unidade: paciente.unidade || this.config.unidade,
      });

      const response = await this.client.post('/homecare/paciente', request);
      
      logger.info(`✅ Paciente registrado: ${paciente.cpf}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Erro ao registrar paciente ${paciente.cpf}`, {
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Busca paciente por CPF
   */
  async buscarPaciente(cpf: string) {
    try {
      const request = this.createRequest({
        cpf_paciente: cpf,
      });

      const response = await this.client.post('/homecare/paciente', request);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Erro ao buscar paciente ${cpf}`, error);
      throw error;
    }
  }

  // ========== HOMECARE - AGENDA ==========

  /**
   * Registra agendamento
   */
  async registrarAgenda(agenda: SysVortexAgenda) {
    try {
      const request = this.createRequest({
        cpf_paciente: agenda.cpf_paciente,
        data_inicial: agenda.data_inicial,
        data_final: agenda.data_final,
        unidade: agenda.unidade || this.config.unidade,
      });

      const response = await this.client.post('/homecare/agenda', request);
      
      logger.info(`✅ Agenda registrada para paciente: ${agenda.cpf_paciente}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Erro ao registrar agenda`, {
        error: error.message,
        cpf: agenda.cpf_paciente,
      });
      throw error;
    }
  }

  // ========== FINANCEIRO ==========

  /**
   * Registra/atualiza movimentação financeira
   */
  async registrarFinanceiro(financeiro: SysVortexFinanceiro) {
    try {
      const response = await this.client.post('/financeiro/manut_financeiro', financeiro);
      
      logger.info(`✅ Financeiro registrado: ${financeiro.tipo}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Erro ao registrar financeiro`, {
        error: error.message,
        tipo: financeiro.tipo,
      });
      throw error;
    }
  }

  /**
   * Busca movimentações financeiras por CPF
   */
  async buscarFinanceiro(cpf: string, cpfResponsavel?: string, status: number = 0) {
    try {
      const request = this.createRequest({
        cpf_pessoa: cpf,
        cpf_responsavel: cpfResponsavel || '',
        status, // 0=Todos, 1=Abertos, 2=Pagos
      });

      const response = await this.client.post('/financeiro/registros', request);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Erro ao buscar financeiro ${cpf}`, error);
      throw error;
    }
  }

  // ========== DOWNLOADS - CADASTROS ==========

  /**
   * Baixa lista de centros de custo
   */
  async baixarCentrosCusto() {
    try {
      const request = this.createRequest({ unidade: 0 });
      const response = await this.client.post('/downloads/cc', request);
      
      logger.info('✅ Centros de custo baixados');
      return response.data;
    } catch (error: any) {
      logger.error('❌ Erro ao baixar centros de custo', error);
      throw error;
    }
  }

  /**
   * Busca logo da unidade
   */
  async buscarLogoUnidade() {
    try {
      const request = this.createRequest();
      const response = await this.client.post('/logounidade', request);
      return response.data;
    } catch (error: any) {
      logger.error('❌ Erro ao buscar logo unidade', error);
      throw error;
    }
  }

  // ========== HEALTH CHECK ==========

  /**
   * Verifica se a API está acessível
   */
  async healthCheck(): Promise<boolean> {
    try {
      const request = this.createRequest();
      await this.client.post('/logounidade', request);
      logger.info('✅ SysVortex API está online');
      return true;
    } catch (error) {
      logger.error('❌ SysVortex API está offline', error);
      return false;
    }
  }
}
