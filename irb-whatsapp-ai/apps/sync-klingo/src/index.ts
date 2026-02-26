/**
 * Serviço de Sincronização Klingo → SysVortex
 * 
 * Este serviço consulta dados do Klingo e alimenta o SysVortex
 */
import 'dotenv/config';
import cron from 'node-cron';
import { KlingoAdapter } from './adapters/klingo.adapter.js';
import { SysVortexAdapter } from './adapters/sysvortex.adapter.js';
import { TransformService } from './services/transform.service.js';
import { SyncPatientsJob } from './jobs/sync-patients.job.js';
import { SyncAgendasJob } from './jobs/sync-agendas.job.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info('🚀 Iniciando serviço de sincronização Klingo → SysVortex');

  // ========== VALIDAÇÃO DE ENV ==========
  // Support both KLINGO_LOGIN/KLINGO_SENHA (padrão) and legacy KLINGO_USER/KLINGO_PASS
  const klingoLogin = process.env.KLINGO_LOGIN || process.env.KLINGO_USER;
  const klingoSenha = process.env.KLINGO_SENHA || process.env.KLINGO_PASS;

  if (!klingoLogin || !klingoSenha || !process.env.KLINGO_DOMAIN) {
    logger.error('❌ Variáveis Klingo não configuradas (KLINGO_LOGIN/KLINGO_SENHA/KLINGO_DOMAIN)');
    process.exit(1);
  }

  const requiredEnv = [
    'SYSVORTEX_BASE_URL',
    'SYSVORTEX_CLIENTE',
    'SYSVORTEX_TOKEN',
  ];

  for (const envVar of requiredEnv) {
    if (!process.env[envVar]) {
      logger.error(`❌ Variável de ambiente ${envVar} não configurada`);
      process.exit(1);
    }
  }

  // ========== INICIALIZAR ADAPTERS ==========
  
  const klingo = new KlingoAdapter({
    domain: process.env.KLINGO_DOMAIN || 'irb',
    unidade: parseInt(process.env.KLINGO_UNIDADE || '1'),
    portal: parseInt(process.env.KLINGO_PORTAL || '0'),
  });

  const sysvortex = new SysVortexAdapter({
    baseURL: process.env.SYSVORTEX_BASE_URL!,
    cliente: process.env.SYSVORTEX_CLIENTE!,
    token: process.env.SYSVORTEX_TOKEN!,
    unidade: parseInt(process.env.SYSVORTEX_UNIDADE || '1'),
  });

  const transformer = new TransformService();

  // ========== LOGIN KLINGO ==========
  
  try {
    await klingo.login(klingoLogin, klingoSenha);
  } catch (error) {
    logger.error('❌ Falha ao fazer login no Klingo', error);
    process.exit(1);
  }

  // ========== HEALTH CHECK SYSVORTEX ==========
  
  const isHealthy = await sysvortex.healthCheck();
  if (!isHealthy) {
    logger.warn('⚠️  SysVortex API pode estar offline, mas continuando...');
  }

  // ========== CRIAR JOBS ==========
  
  const syncPatients = new SyncPatientsJob(klingo, sysvortex, transformer);
  const syncAgendas = new SyncAgendasJob(klingo, sysvortex, transformer);

  // ========== MODO INTERATIVO (DESENVOLVIMENTO) ==========
  
  if (process.env.MODE === 'test') {
    logger.info('🧪 Modo teste: executando uma vez com limite de 5 registros');
    
    try {
      await syncPatients.execute({ limit: 5 });
      await syncAgendas.execute({ limit: 5 });
      
      logger.info('✅ Teste concluído com sucesso!');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Erro no teste', error);
      process.exit(1);
    }
  }

  // ========== EXECUTAR UMA VEZ AO INICIAR ==========
  
  if (process.env.RUN_ON_START !== 'false') {
    logger.info('▶️  Executando sincronização inicial...');
    
    try {
      await syncPatients.execute({ limit: 10 }); // Limite inicial para segurança
      await syncAgendas.execute();
    } catch (error) {
      logger.error('❌ Erro na sincronização inicial', error);
    }
  }

  // ========== AGENDAR EXECUÇÕES PERIÓDICAS ==========
  
  const enabled = process.env.SYNC_ENABLED !== 'false';
  
  if (!enabled) {
    logger.warn('⏸️  Sincronização agendada desabilitada (SYNC_ENABLED=false)');
    logger.info('Pressione Ctrl+C para sair');
    return;
  }

  const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '15');
  
  logger.info(`⏰ Agendando sincronizações a cada ${intervalMinutes} minutos`);

  // Agenda: sincroniza a cada X minutos
  cron.schedule(`*/${intervalMinutes} * * * *`, async () => {
    logger.info('⏰ Executando sincronização agendada...');
    
    try {
      await syncAgendas.execute(); // Agendas são mais urgentes
      await syncPatients.execute({ limit: 50 }); // Limitar pacientes em batch
    } catch (error) {
      logger.error('❌ Erro na sincronização agendada', error);
    }
  });

  // Pacientes: sincroniza diariamente às 2h da manhã (carga completa)
  cron.schedule('0 2 * * *', async () => {
    logger.info('⏰ Executando sincronização completa de pacientes...');
    
    try {
      await syncPatients.execute(); // Sem limite = todos
    } catch (error) {
      logger.error('❌ Erro na sincronização completa', error);
    }
  });

  logger.info('✅ Serviço de sincronização iniciado e rodando');
  logger.info('Pressione Ctrl+C para sair');

  // ========== GRACEFUL SHUTDOWN ==========
  
  process.on('SIGINT', () => {
    logger.info('👋 Encerrando serviço de sincronização...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('👋 Encerrando serviço de sincronização...');
    process.exit(0);
  });
}

// ========== EXECUTAR ==========

main().catch((error) => {
  logger.error('❌ Erro fatal', error);
  process.exit(1);
});
