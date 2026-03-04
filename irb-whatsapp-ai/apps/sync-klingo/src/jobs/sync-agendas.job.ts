/**
 * Job: Sincronizar Agendas Klingo → SysVortex
 */
import { KlingoAdapter } from '../adapters/klingo.adapter.js';
import { SysVortexAdapter } from '../adapters/sysvortex.adapter.js';
import { TransformService } from '../services/transform.service.js';
import { logger } from '../utils/logger.js';

export class SyncAgendasJob {
  constructor(
    private klingo: KlingoAdapter,
    private sysvortex: SysVortexAdapter,
    private transformer: TransformService
  ) {}

  async execute(options: { data?: string; limit?: number } = {}) {
    const startTime = Date.now();
    logger.info('🔄 Iniciando sincronização de agendas...');

    try {
      // 1. Buscar agendas do Klingo
      const dataAgenda = options.data || new Date().toISOString().split('T')[0];
      const klingoAgendas = await this.klingo.getAgendas(dataAgenda);

      if (!Array.isArray(klingoAgendas)) {
        logger.warn('Nenhuma agenda retornada do Klingo');
        return { success: 0, errors: 0, skipped: 0 };
      }

      const agendas = options.limit 
        ? klingoAgendas.slice(0, options.limit)
        : klingoAgendas;

      logger.info(`📋 ${agendas.length} agendas encontradas no Klingo para ${dataAgenda}`);

      // Estatísticas
      let success = 0;
      let errors = 0;
      let skipped = 0;

      // 2. Processar cada agenda
      for (const klingoAgenda of agendas) {
        try {
          // Verificar se tem informações do paciente
          if (!klingoAgenda.id_paciente && !klingoAgenda.st_cpf) {
            logger.warn(`⏭️  Agenda sem paciente`);
            skipped++;
            continue;
          }

          // Se não tiver CPF, buscar paciente no Klingo
          let cpfPaciente = klingoAgenda.st_cpf;
          if (!cpfPaciente && klingoAgenda.id_paciente) {
            try {
              const paciente = await this.klingo.getPacienteById(klingoAgenda.id_paciente);
              cpfPaciente = paciente.st_cpf;
            } catch (error) {
              logger.warn(`⏭️  Não foi possível buscar CPF do paciente ${klingoAgenda.id_paciente}`);
              skipped++;
              continue;
            }
          }

          // Adicionar CPF ao objeto agenda
          const agendaComCpf = { ...klingoAgenda, st_cpf: cpfPaciente };

          // Transformar para formato SysVortex
          const agendaSysVortex = this.transformer.transformAgenda(agendaComCpf);

          // Enviar para SysVortex
          await this.sysvortex.registrarAgenda(agendaSysVortex);
          
          success++;
          logger.debug(`✅ Agenda sincronizada: ${agendaSysVortex.cpf_paciente}`);

          // Delay para não sobrecarregar API
          await this.delay(100);

        } catch (error: any) {
          errors++;
          logger.error(`❌ Erro ao sincronizar agenda`, {
            id: klingoAgenda.id_agenda,
            error: error.message,
          });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      logger.info('✅ Sincronização de agendas concluída', {
        duration: `${duration}s`,
        total: agendas.length,
        success,
        errors,
        skipped,
      });

      return { success, errors, skipped };

    } catch (error: any) {
      logger.error('❌ Erro fatal na sincronização de agendas', error);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
