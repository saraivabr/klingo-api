import bcrypt from 'bcryptjs';

const hash = '$2a$10$JZvRFsEx3fP2qaiqLExz2OqQwrOoF8ffgMuKk1G2rHQTkZwEE/.vu';
const password = 'admin123';

const match = await bcrypt.compare(password, hash);
console.log(`Password "admin123" matches hash: ${match ? '✓ YES' : '✗ NO'}`);
