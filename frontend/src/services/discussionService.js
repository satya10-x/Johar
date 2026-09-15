import api from './api.js';

export function listDiscussions(params = {}) {
  return api.get('/discussions', { params }).then((res) => res.data);
}

export function getNearbyDiscussions(params = {}) {
  return api.get('/discussions/nearby', { params }).then((res) => res.data);
}

export function getDiscussion(id) {
  return api.get(`/discussions/${id}`).then((res) => res.data);
}

export function createDiscussion(data) {
  return api.post('/discussions', data).then((res) => res.data);
}

export function updateDiscussion(id, data) {
  return api.patch(`/discussions/${id}`, data).then((res) => res.data);
}

export function deleteDiscussion(id) {
  return api.delete(`/discussions/${id}`).then((res) => res.data);
}

export function joinDiscussion(id) {
  return api.post(`/discussions/${id}/join`).then((res) => res.data);
}

export function leaveDiscussion(id) {
  return api.delete(`/discussions/${id}/join`).then((res) => res.data);
}

export function getComments(id, params = {}) {
  return api.get(`/discussions/${id}/comments`, { params }).then((res) => res.data);
}

export function addComment(id, text) {
  return api.post(`/discussions/${id}/comments`, { text }).then((res) => res.data);
}

export function reportDiscussion(id, reason, details) {
  return api
    .post(`/discussions/${id}/report`, { reason, details })
    .then((res) => res.data);
}
