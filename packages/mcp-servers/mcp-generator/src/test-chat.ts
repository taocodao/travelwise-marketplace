import axios from 'axios';

async function test() {
  try {
    const res = await axios.post('http://localhost:3008/tools/chat_completion', {
      message: 'google map ai'
    });
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (e:any) {
    console.error('Error:', e.message);
    if (e.response) {
        console.error('Data:', e.response.data);
    }
  }
}
test();
