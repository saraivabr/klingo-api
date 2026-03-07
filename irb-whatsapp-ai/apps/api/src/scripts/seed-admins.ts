import 'dotenv/config';
import { db, schema } from '@irb/database';
import bcrypt from 'bcryptjs';

async function seedAdmins() {
  const admins = [
    { email: 'allan@irbprimecare.com.br', name: 'Allan', role: 'admin' },
    { email: 'rafael@irbprimecare.com.br', name: 'Rafael', role: 'admin' },
  ];

  for (const admin of admins) {
    const passwordHash = await bcrypt.hash('IRBPrime2026@', 10);

    await db
      .insert(schema.users)
      .values({ ...admin, passwordHash })
      .onConflictDoNothing();

    console.log(`Admin ${admin.email} criado (ou ja existia)`);
  }

  console.log('\nSenha temporaria: IRBPrime2026@');
  console.log('Os usuarios devem trocar a senha no primeiro acesso.\n');
  process.exit(0);
}

seedAdmins().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
