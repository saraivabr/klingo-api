/**
 * Klingo API Adapter - Cliente TypeScript para API Klingo
 * Baseado no klingo_api.py existente
 */
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';

export interface KlingoConfig {
  domain: string;
  unidade: number;
  portal: number;
}

export interface KlingoLoginResponse {
  access_token?: string;
  token?: string;
  [key: string]: any;
}

export class KlingoAdapter {
  private baseURL = 'https://api.klingo.app/api';
  private token: string | null = null;
  private session: AxiosInstance;
  private config: KlingoConfig;

  constructor(config: KlingoConfig) {
    this.config = config;
    this.session = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=utf-8',
        'X-DOMAIN': config.domain,
        'X-PORTAL': String(config.portal),
        'X-UNIDADE': String(config.unidade),
      },
    });
  }

  async login(usuario: string, senha: string): Promise<void> {
    try {
      const response = await this.session.post<KlingoLoginResponse>('/login', {
        login: usuario,
        senha: senha,
      });

      this.token = response.data.access_token || response.data.token || null;
      
      if (!this.token) {
        throw new Error('Token não encontrado na resposta de login');
      }

      this.session.defaults.headers['Authorization'] = `Bearer ${this.token}`;
      logger.info('✅ Login Klingo realizado com sucesso');
    } catch (error) {
      logger.error('❌ Erro ao fazer login no Klingo', error);
      throw error;
    }
  }

  /**
   * Executa uma query AQL (Application Query Language)
   */
  private async aql<T = any>(
    name: string,
    parms: Record<string, any> = {},
    idAlias: string = 'item',
    action?: string,
    page?: number
  ): Promise<T> {
    const query = {
      name,
      id: idAlias,
      parms,
    };

    const params: Record<string, any> = {};
    if (action) params.a = action;
    if (page) params.page = page;

    try {
      const response = await this.session.post('/aql', 
        { q: [query] },
        { params }
      );

      const data = response.data;

      // Verificar erro com HTTP 200
      if (data.status && data.error && parseInt(String(data.status)) >= 400) {
        throw new Error(`Erro AQL (${name}): ${data.error}`);
      }

      // Extrair resultado pelo alias
      if (data[idAlias]) {
        const result = data[idAlias];
        if (result.data) {
          return result.data as T;
        }
        return result as T;
      }

      return data as T;
    } catch (error) {
      logger.error(`Erro AQL (${name})`, error);
      throw error;
    }
  }

  // ========== MÓDULOS ==========

  /**
   * Busca pacientes
   */
  async getPacientes(search: string = '', page: number = 1) {
    return this.aql('pacientes.index', 
      { search, page }, 
      'lista', 
      'pacientes.index'
    );
  }

  /**
   * Detalha um paciente
   */
  async getPacienteById(idPessoa: number) {
    return this.aql('pacientes.show', 
      { id: idPessoa }, 
      'item', 
      'pacientes.show'
    );
  }

  /**
   * Lista médicos
   */
  async getMedicos(ativos: boolean = true) {
    return this.aql('medicos.index', 
      { ativos }, 
      'lista', 
      'medicos.index'
    );
  }

  /**
   * Lista especialidades
   */
  async getEspecialidades(ativadas: boolean = true) {
    return this.aql('especialidades.index', 
      { ativadas }, 
      'lista', 
      'especialidades.index'
    );
  }

  /**
   * Lista agendas
   */
  async getAgendas(data?: string, filtros: Record<string, any> = {}) {
    const dataFinal = data || new Date().toISOString().split('T')[0];
    
    return this.aql('agendas.index', 
      {
        data: dataFinal,
        turno: 'G',
        medico: '',
        medicos: null,
        group: 'none',
        livres: 0,
        status: 'T',
        especialidade: '',
        unidade_operacao: 1,
        faixa_hora: 'D',
        recepcao: '',
        search: null,
        view_status: '',
        id_atendimento: null,
        id_fila_laudo: '',
        tipo_proced: 'T',
        editados: false,
        ...filtros
      }, 
      'lista', 
      'agendas.index'
    );
  }

  /**
   * Lista operadoras/convênios
   */
  async getOperadoras() {
    return this.aql('operadoras.index', 
      {}, 
      'lista', 
      'operadoras.index'
    );
  }

  /**
   * Lista procedimentos
   */
  async getProcedimentos(search: string = '') {
    return this.aql('procedimentos.index', 
      { search }, 
      'lista'
    );
  }

  /**
   * Multi-query - executa várias queries de uma vez
   */
  async multiQuery(queries: Array<{ name: string; id: string; parms?: any }>) {
    try {
      const response = await this.session.post('/aql', { q: queries });
      return response.data;
    } catch (error) {
      logger.error('Erro multi-query', error);
      throw error;
    }
  }
}
