import { hashPassword } from '../db/seed';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Uso: bun run src/scripts/hash-password.ts <senha-em-texto>

Descrição:
  Gera um hash bcrypt (custo 12) para a senha informada.
  Use este hash na variável ADMIN_PASSWORD_HASH no arquivo .env
  para evitar armazenar a senha em texto plano no ambiente de produção.

Exemplo:
  bun run src/scripts/hash-password.ts "Vinhaf@1"

Depois, copie o valor impresso e cole no .env:
  ADMIN_PASSWORD_HASH=\$2a\$12\$...
`);
  process.exit(args.length === 0 ? 1 : 0);
}

const [plainPassword] = args;

if (!plainPassword || plainPassword.length < 8) {
  console.error('❌ Erro: a senha deve ter pelo menos 8 caracteres.');
  process.exit(1);
}

(async () => {
  try {
    const hash = await hashPassword(plainPassword);
    console.log('\n✅ Hash bcrypt gerado com sucesso:');
    console.log('');
    console.log(hash);
    console.log('');
    console.log('Copie o valor ACIMA (incluindo $2a$...) e cole no seu .env:');
    console.log('');
    console.log(`  ADMIN_PASSWORD_HASH=${hash}`);
    console.log('');
    console.log('💡 Em seguida, REMOVA a linha ADMIN_PASSWORD do seu .env de produção.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Falha ao gerar hash:', err?.message || err);
    process.exit(1);
  }
})();
