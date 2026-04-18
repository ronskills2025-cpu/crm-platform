const axios = require('axios');

async function sendTestMessage() {
  try {
    console.log('🧪 Sending WhatsApp test message...');
    
    const response = await axios.post('http://localhost:4000/api/wa-chat/test', {
      phone: '+1234567890',
      message: `🧪 Test message from CRM Dashboard - ${new Date().toLocaleTimeString()}

✨ WhatsApp Features Available:
✅ Real-time messaging
✅ Media sharing (images, videos, documents)  
✅ Message status tracking (sent, delivered, read)
✅ Contact management & profiles
✅ Conversation archiving & pinning
✅ Message search functionality
✅ Automated responses & bots
✅ Group chat support
✅ Message templates
✅ Webhook integration
✅ Analytics & reporting

🔄 This message should appear in your chat interface!`
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // You may need to get a real token
      }
    });

    if (response.data.success) {
      console.log('✅ Test message sent successfully!');
      console.log('📊 Response:', response.data);
      console.log('💬 Conversation ID:', response.data.conversation_id);
      console.log('🔄 Check your WhatsApp Chat interface - the conversation should appear!');
    } else {
      console.log('❌ Test failed:', response.data.error);
    }
  } catch (error) {
    console.log('❌ Error sending test message:');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.error || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n🔐 Authentication required. You may need to:');
      console.log('1. Login to the dashboard first');
      console.log('2. Get a valid auth token');
      console.log('3. Configure WhatsApp credentials');
    }
    
    if (error.response?.status === 400) {
      console.log('\n⚙️ Configuration issue. You may need to:');
      console.log('1. Configure WhatsApp API credentials');
      console.log('2. Set up phone number ID and access token');
      console.log('3. Verify webhook configuration');
    }
  }
}

sendTestMessage();
