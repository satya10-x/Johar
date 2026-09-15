import api from './api.js';

export function listSolutions(params = {}) {
  return api.get('/solutions', { params }).then((res) => res.data);
}

export function getSolution(id) {
  return api.get(`/solutions/${id}`).then((res) => res.data);
}
