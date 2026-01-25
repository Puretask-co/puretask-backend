// Generate bcrypt hash for password
const bcrypt = require('bcryptjs');

const password = 'BaileeJane7!';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  console.log('\n🔐 Password Hash Generated:\n');
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\n✅ Copy this hash to use in SQL UPDATE statement\n');
});

