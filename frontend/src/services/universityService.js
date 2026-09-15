import api from './api.js';

export function listUniversities(params = {}) {
  return api.get('/universities', { params }).then((res) => res.data);
}

export function getUniversity(id) {
  return api.get(`/universities/${id}`).then((res) => res.data);
}

export function createUniversity(data) {
  return api.post('/universities', data).then((res) => res.data);
}

export function updateUniversity(id, data) {
  return api.patch(`/universities/${id}`, data).then((res) => res.data);
}

export function getAssignedChallenges(id, params = {}) {
  return api.get(`/universities/${id}/challenges`, { params }).then((res) => res.data);
}

export function getUniversityMatches(challengeId, force = false) {
  return api
    .get(`/challenges/${challengeId}/university-matches${force ? '?force=true' : ''}`)
    .then((res) => res.data);
}

export function assignUniversity(challengeId, universityId) {
  return api
    .post(`/challenges/${challengeId}/assign-university`, { universityId })
    .then((res) => res.data);
}

export function sendUniversityResponse(challengeId, data) {
  return api
    .post(`/challenges/${challengeId}/university-response`, data)
    .then((res) => res.data);
}
