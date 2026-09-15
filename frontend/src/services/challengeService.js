import api from './api.js';

export function createChallenge(formData) {
  return api
    .post('/challenges', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((res) => res.data);
}

export async function listChallenges(params = {}) {
  const res = await api.get('/challenges', { params });
  return res.data;
}

export function getNearbyChallenges(params) {
  return api.get('/challenges/nearby', { params }).then((res) => res.data);
}

export function getAreaSummary(params) {
  return api.get('/challenges/summary', { params }).then((res) => res.data);
}

export function getChallenge(id) {
  return api.get(`/challenges/${id}`).then((res) => res.data);
}

export function updateChallenge(id, data) {
  return api.patch(`/challenges/${id}`, data).then((res) => res.data);
}

export function deleteChallenge(id) {
  return api.delete(`/challenges/${id}`).then((res) => res.data);
}

export function analyzeChallenge(id, force = false) {
  return api
    .post(`/challenges/${id}/analyze${force ? '?force=true' : ''}`)
    .then((res) => res.data);
}

export function checkDuplicates(id, force = false) {
  return api
    .post(`/challenges/${id}/check-duplicates${force ? '?force=true' : ''}`)
    .then((res) => res.data);
}

export function addValidation(id, data) {
  return api.post(`/challenges/${id}/validate`, data).then((res) => res.data);
}

export function removeValidation(id, type) {
  return api
    .delete(`/challenges/${id}/validate`, { params: type ? { type } : {} })
    .then((res) => res.data);
}

export function getValidations(id, page = 1) {
  return api.get(`/challenges/${id}/validations`, { params: { page } }).then((res) => res.data);
}
