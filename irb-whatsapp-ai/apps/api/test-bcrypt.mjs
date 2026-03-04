import bcrypt from 'bcryptjs';

const hash = '$2b$10$N9qo8uLOickgx2ZMRZoMye7dIHgZ6EsNzLi43z8H9MH5ZDXnG6Fju';

// Test with various common passwords
const testPasswords = ['password', '123456', 'admin', 'irb', 'irb_dev_2024', 'admin123', 'admin@irb'];

async function test() {
  for (const pwd of testPasswords) {
    const match = await bcrypt.compare(pwd, hash);
    console.log(`Password "${pwd}": ${match ? '✓ MATCH' : '✗ no match'}`);
  }
}

test();
