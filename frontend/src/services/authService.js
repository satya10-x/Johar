import api from './api.js';

export function registerUser(data) {
  return api.post('/auth/register', data).then((res) => res.data);
}

export function loginUser(data) {
  return api.post('/auth/login', data).then((res) => res.data);
}

export function fetchMe() {
  return api.get('/auth/me').then((res) => res.data);
}
