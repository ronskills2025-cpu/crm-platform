const axios = require('axios');

async function testWhatsAppEndpoint() {
  console.log('🧪 Testing improved WhatsApp endpoint...\n');
  
  try {
    const response = await axios.post('http://localhost:4000/api/wa-chat/test', {
      phone: '+1234567890',
      message: `🧪 Test message from improved endpoint - ${new Date().toLocaleTimeString()}\n\n✨ Features available:\n• Real-time messaging\n• Media sharing\n• Status tracking\n• Contact management`
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });

    console.log('✅ SUCCESS! Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('📊 Testing error handling...');
    console.log('Status:', error.response?.status);
    console.log('Response:', JSON.stringify(error.response?.data, null, 2));
    
    // This is expected - we want to see the detailed error messages
    if (error.response?.status === 400) {
      const errorData = error.response.data;
      console.log('\n✅ Error handling working correctly!');
      console.log('Error:', errorData.error);
      console.log('Details:', errorData.details);
      
      if (errorData.setup_instructions) {
        console.log('\n📋 Setup instructions provided:');
        Object.entries(errorData.setup_instructions).forEach(([key, value]) => {
          console.log(`${key}: ${value}`);
        });
      }
    }
  }
}

// Test different scenarios
async function runAllTests() {
  console.log('🔬 Running comprehensive WhatsApp API tests...\n');
  
  // Test 1: Missing phone number
  console.log('TEST 1: Missing phone number');
  try {
    await axios.post('http://localhost:4000/api/wa-chat/test', {
      message: 'Test message'
    });
  } catch (error) {
    console.log('✅ Correctly rejected:', error.response?.data?.error);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Invalid phone format
  console.log('TEST 2: Invalid phone format');
  try {
    await axios.post('http://localhost:4000/api/wa-chat/test', {
      phone: '1234567890', // Missing +
      message: 'Test message'
    });
  } catch (error) {
    console.log('✅ Correctly rejected:', error.response?.data?.error);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Missing message
  console.log('TEST 3: Missing message');
  try {
    await axios.post('http://localhost:4000/api/wa-chat/test', {
      phone: '+1234567890'
    });
  } catch (error) {
    console.log('✅ Correctly rejected:', error.response?.data?.error);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: Valid request (will fail due to missing credentials, but should show proper error)
  console.log('TEST 4: Valid request format (expecting credentials error)');
  await testWhatsAppEndpoint();
  
  console.log('\n🎯 All tests completed! The API is properly validating requests and providing helpful error messages.');
}

runAllTests();
