// Test script for Binance API connection
const axios = require('axios');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.BINANCE_API_KEY;
const SECRET_KEY = process.env.BINANCE_SECRET_KEY;
const BASE_URL = 'https://api.binance.com';

console.log('🔍 Testing Binance API Connection...\n');
console.log(`API Key: ${API_KEY ? '✅ Found' : '❌ Not found'}`);
console.log(`Secret Key: ${SECRET_KEY ? '✅ Found' : '❌ Not found'}\n`);

if (!API_KEY || !SECRET_KEY) {
  console.log('❌ ERROR: API keys not configured!');
  console.log('\n📝 To fix:');
  console.log('1. Go to https://www.binance.com/en/my/settings/api-management');
  console.log('2. Create an API key with "Read Info" permissions');
  console.log('3. Copy the API Key and Secret Key');
  console.log('4. Create a file: engine-v2/.env.local');
  console.log('5. Add:');
  console.log('   BINANCE_API_KEY=your_key_here');
  console.log('   BINANCE_SECRET_KEY=your_secret_here');
  process.exit(1);
}

// Generate signature
function generateSignature(queryString, secretKey) {
  return crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');
}

// Test connectivity
async function testConnectivity() {
  console.log('📡 Testing connectivity...');
  try {
    const response = await axios.get(`${BASE_URL}/api/v3/ping`);
    console.log('✅ Binance API is reachable');
  } catch (error) {
    console.log('❌ Cannot reach Binance API');
    console.log('Error:', error.message);
    process.exit(1);
  }
}

// Test server time
async function testServerTime() {
  console.log('\n⏰ Getting server time...');
  try {
    const response = await axios.get(`${BASE_URL}/api/v3/time`);
    const serverTime = new Date(response.data.serverTime);
    const clientTime = new Date();
    const diff = Math.abs(serverTime - clientTime);
    
    console.log(`Server time: ${serverTime.toISOString()}`);
    console.log(`Client time: ${clientTime.toISOString()}`);
    console.log(`Time difference: ${diff}ms`);
    
    if (diff > 5000) {
      console.log('⚠️ WARNING: Time difference is more than 5 seconds!');
    }
  } catch (error) {
    console.log('❌ Error getting server time');
    console.log('Error:', error.message);
  }
}

// Test account info
async function testAccountInfo() {
  console.log('\n💰 Getting account info...');
  
  try {
    const timestamp = Date.now();
    const params = new URLSearchParams({
      timestamp: timestamp.toString()
    });
    
    const queryString = params.toString();
    const signature = generateSignature(queryString, SECRET_KEY);
    
    const response = await axios.get(`${BASE_URL}/api/v3/account?${queryString}&signature=${signature}`, {
      headers: {
        'X-MBX-APIKEY': API_KEY
      }
    });
    
    console.log('✅ Account info retrieved successfully!\n');
    
    // Parse and display balances
    const balances = response.data.balances
      .filter(bal => parseFloat(bal.free) > 0 || parseFloat(bal.locked) > 0)
      .map(bal => ({
        asset: bal.asset,
        free: parseFloat(bal.free),
        locked: parseFloat(bal.locked),
        total: parseFloat(bal.free) + parseFloat(bal.locked)
      }));
    
    console.log('📊 Your Balances:');
    console.log('─'.repeat(60));
    balances.forEach(bal => {
      console.log(`${bal.asset.padEnd(10)} Total: ${bal.total.toFixed(8)}`);
    });
    
    // Calculate total USDT
    const usdt = balances.find(b => b.asset === 'USDT');
    console.log('─'.repeat(60));
    console.log(`Total USDT: ${usdt ? usdt.total.toFixed(2) : '0.00'} USDT`);
    
  } catch (error) {
    console.log('❌ Error getting account info');
    console.log('Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Possible causes:');
      console.log('1. Invalid API Key or Secret Key');
      console.log('2. API Key does not have "Read Info" permission');
      console.log('3. IP address not whitelisted (if using IP restriction)');
    }
  }
}

// Run tests
async function runTests() {
  await testConnectivity();
  await testServerTime();
  await testAccountInfo();
  
  console.log('\n✅ Tests completed!');
}

runTests();

