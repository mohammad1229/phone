const crypto = require('crypto');
const readline = require('readline');

const SECRET_KEY = "FANNIPRO_SECRET_2026";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('=================================');
console.log('   FanniPro Key Generator Tool   ');
console.log('=================================\n');

rl.question('Enter Customer Hardware ID (HWID): ', (hwid) => {
  hwid = hwid.trim().toUpperCase();
  
  rl.question('Enter Expiry Date (YYYY-MM-DD) e.g., 2027-05-17: ', (expiry) => {
    expiry = expiry.trim();
    
    try {
      const epoch = new Date('2026-01-01');
      const expDate = new Date(expiry);
      const diffTime = expDate - epoch;
      const offsetDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const offsetStr = String(offsetDays).padStart(4, '0');
      
      const hash = crypto.createHash('sha256')
        .update(hwid + offsetStr + SECRET_KEY)
        .digest('hex');
      const decVal = parseInt(hash.substring(0, 8), 16);
      const checksum = String(decVal % 1000000).padStart(6, '0');
      
      const finalCode = offsetStr + checksum;
      
      console.log('\n=================================');
      console.log('✅ 10-Digit Activation Code Generated Successfully!');
      console.log('Give this code to your customer:');
      console.log('\n' + finalCode + '\n');
      console.log('=================================\n');
    } catch(err) {
      console.log('Error generating code: ' + err.message);
    }
    
    rl.close();
  });
});
