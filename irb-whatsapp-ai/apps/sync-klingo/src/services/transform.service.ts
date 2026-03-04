/**
 * Serviço de transformação de dados Klingo → SysVortex
 */
import { logger } from '../utils/logger.js';
import type { SysVortexPaciente, SysVortexAgenda } from '../types/sysvortex.js';

export class TransformService {
  /**
   * Transforma paciente Klingo → SysVortex
   */
  transformPaciente(klingoPaciente: any): SysVortexPaciente {
    try {
      // Limpar CPF (remover formatação)
      const cpf = this.cleanCPF(klingoPaciente.st_cpf || '');
      
      if (!cpf) {
        throw new Error(`Paciente sem CPF: ${klingoPaciente.st_nome}`);
      }

      const paciente: SysVortexPaciente = {
        cpf,
        nome: klingoPaciente.st_nome || '',
        dtnasc: this.formatDateKlingoToSysVortex(klingoPaciente.dt_nascimento),
        sexo: this.mapSexo(klingoPaciente.st_sexo),
        telefone: this.cleanPhone(klingoPaciente.st_telefone),
        celular: this.cleanPhone(klingoPaciente.st_celular),
        email: klingoPaciente.st_email || '',
        cep: this.cleanCEP(klingoPaciente.st_cep),
        endereco: klingoPaciente.st_endereco || '',
        numero: klingoPaciente.st_numero || '',
        bairro: klingoPaciente.st_bairro || '',
        cidade: klingoPaciente.st_cidade || '',
        uf: klingoPaciente.st_uf || '',
        complemento: klingoPaciente.st_complemento || '',
      };

      logger.debug(`Paciente transformado: ${paciente.nome} (${cpf})`);
      return paciente;
    } catch (error: any) {
      logger.error('Erro ao transformar paciente', {
        error: error.message,
        paciente: klingoPaciente,
      });
      throw error;
    }
  }

  /**
   * Transforma agendamento Klingo → SysVortex
   */
  transformAgenda(klingoAgenda: any): SysVortexAgenda {
    try {
      // Buscar CPF do paciente (pode vir em diferentes campos)
      const cpf = this.cleanCPF(
        klingoAgenda.st_cpf || 
        klingoAgenda.paciente_cpf ||
        klingoAgenda.cpf
      );

      if (!cpf) {
        throw new Error(`Agendamento sem CPF do paciente`);
      }

      // Data da agenda
      const dataAgenda = klingoAgenda.data || klingoAgenda.dt_agenda;
      
      const agenda: SysVortexAgenda = {
        cpf_paciente: cpf,
        data_inicial: this.formatDateToSysVortexDate(dataAgenda),
        data_final: this.formatDateToSysVortexDate(dataAgenda),
        unidade: klingoAgenda.id_unidade_operacao || 1,
      };

      logger.debug(`Agenda transformada: ${cpf} em ${dataAgenda}`);
      return agenda;
    } catch (error: any) {
      logger.error('Erro ao transformar agenda', {
        error: error.message,
        agenda: klingoAgenda,
      });
      throw error;
    }
  }

  // ========== UTILITÁRIOS ==========

  /**
   * Limpa CPF (remove pontos, traços, espaços)
   */
  private cleanCPF(cpf: string): string {
    if (!cpf) return '';
    return cpf.replace(/\D/g, '');
  }

  /**
   * Limpa telefone
   */
  private cleanPhone(phone: string): string {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  }

  /**
   * Limpa CEP
   */
  private cleanCEP(cep: string): string {
    if (!cep) return '';
    return cep.replace(/\D/g, '');
  }

  /**
   * Mapeia sexo Klingo → SysVortex
   * Klingo: M/F, SysVortex: 0=Masculino, 1=Feminino
   */
  private mapSexo(sexo: string): number {
    if (!sexo) return 0;
    const sexoUpper = sexo.toUpperCase();
    if (sexoUpper === 'M' || sexoUpper === 'MASCULINO') return 0;
    if (sexoUpper === 'F' || sexoUpper === 'FEMININO') return 1;
    return 0;
  }

  /**
   * Converte data Klingo (YYYY-MM-DD) → SysVortex (YYYY-MM-DD)
   * Na verdade são iguais, mas mantém função para flexibilidade
   */
  private formatDateKlingoToSysVortex(date: string | null): string {
    if (!date) return '';
    
    // Se já estiver em formato ISO, usar direto
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}/)) {
      return date.split('T')[0]; // Remove hora se tiver
    }
    
    return '';
  }

  /**
   * Formata data para formato YYYYMMDD (usado em agendas)
   */
  private formatDateToSysVortexDate(date: string | null): string {
    if (!date) {
      // Se não tiver data, usar hoje
      const hoje = new Date();
      const ano = hoje.getFullYear();
      const mes = String(hoje.getMonth() + 1).padStart(2, '0');
      const dia = String(hoje.getDate()).padStart(2, '0');
      return `${ano}${mes}${dia}`;
    }

    // Parse da data (assumindo YYYY-MM-DD ou ISO)
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      throw new Error(`Data inválida: ${date}`);
    }

    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    
    return `${ano}${mes}${dia}`;
  }

  /**
   * Valida se CPF tem 11 dígitos
   */
  validateCPF(cpf: string): boolean {
    const cleaned = this.cleanCPF(cpf);
    return cleaned.length === 11;
  }
}
