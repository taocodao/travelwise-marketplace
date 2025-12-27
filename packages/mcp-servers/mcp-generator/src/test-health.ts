
import axios from 'axios';
console.log('Checking health...');
axios.get('http://localhost:3006/health')
  .then(res => console.log('OK:', res.data))
  .catch(err => console.error('FAIL:', err.message));
