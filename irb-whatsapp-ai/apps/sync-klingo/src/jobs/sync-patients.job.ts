/**
 * Job: Sincronizar Pacientes Klingo → SysVortex
 */
import { KlingoAdapter } from '../adapters/klingo.adapter.js';
import { SysVortexAdapter } from '../adapters/sysvortex.adapter.js';
import { TransformService } from '../services/transform.service.js';
import { logger } from '../utils/logger.js';

export class SyncPatientsJob {
  constructor(
    private klingo: KlingoAdapter,
    private sysvortex: SysVortexAdapter,
    private transformer: TransformService
  ) {}

  async execute(options: { search?: string; limit?: number } = {}) {
    const startTime = Date.now();
    logger.info('🔄 Iniciando sincronização de pacientes...');

    try {
      // 1. Buscar pacientes do Klingo
      const klingoPacientes = await this.klingo.getPacientes(options.search || '');
      
      if (!Array.isArray(klingoPacientes)) {
        logger.warn('Nenhum paciente retornado do Klingo');
        return { success: 0, errors: 0, skipped: 0 };
      }

      const pacientes = options.limit 
        ? klingoPacientes.slice(0, options.limit)
        : klingoPacientes;

      logger.info(`📋 ${pacientes.length} pacientes encontrados no Klingo`);

      // Estatísticas
      let success = 0;
      let errors = 0;
      let skipped = 0;

      // 2. Processar cada paciente
      for (const klingoPaciente of pacientes) {
        try {
          // Validar se tem CPF
          if (!klingoPaciente.st_cpf) {
            logger.warn(`⏭️  Paciente sem CPF: ${klingoPaciente.st_nome}`);
            skipped++;
            continue;
          }

          // Transformar para formato SysVortex
          const pacienteSysVortex = this.transformer.transformPaciente(klingoPaciente);

          // Validar CPF
          if (!this.transformer.validateCPF(pacienteSysVortex.cpf)) {
            logger.warn(`⏭️  CPF inválido: ${pacienteSysVortex.cpf} (${pacienteSysVortex.nome})`);
            skipped++;
            continue;
          }

          // Enviar para SysVortex
          await this.sysvortex.registrarPaciente(pacienteSysVortex);
          
          success++;
          logger.debug(`✅ ${pacienteSysVortex.nome} sincronizado`);

          // Delay para não sobrecarregar API
          await this.delay(100);

        } catch (error: any) {
          errors++;
          logger.error(`❌ Erro ao sincronizar paciente`, {
            nome: klingoPaciente.st_nome,
            cpf: klingoPaciente.st_cpf,
            error: error.message,
          });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      logger.info('✅ Sincronização de pacientes concluída', {
        duration: `${duration}s`,
        total: pacientes.length,
        success,
        errors,
        skipped,
      });

      return { success, errors, skipped };

    } catch (error: any) {
      logger.error('❌ Erro fatal na sincronização de pacientes', error);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
