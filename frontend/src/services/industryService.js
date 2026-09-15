import api from './api.js';

export function listIndustries(params = {}) {
  return api.get('/industries', { params }).then((res) => res.data);
}

export function getIndustry(id) {
  return api.get(`/industries/${id}`).then((res) => res.data);
}

export function createIndustry(data) {
  return api.post('/industries', data).then((res) => res.data);
}

export function updateIndustry(id, data) {
  return api.patch(`/industries/${id}`, data).then((res) => res.data);
}

export function getMatchedProjects(id) {
  return api.get(`/industries/${id}/matched-projects`).then((res) => res.data);
}

export function getProject(id) {
  return api.get(`/projects/${id}`).then((res) => res.data);
}

export function listProjects(params = {}) {
  return api.get('/projects', { params }).then((res) => res.data);
}

export function createProject(data) {
  return api.post('/projects', data).then((res) => res.data);
}

export function getIndustryMatches(projectId, force = false) {
  return api
    .get(`/projects/${projectId}/industry-matches${force ? '?force=true' : ''}`)
    .then((res) => res.data);
}

export function sendCollaborationRequest(projectId, data) {
  return api
    .post(`/projects/${projectId}/collaboration-request`, data)
    .then((res) => res.data);
}

export function sendFundingCommitment(projectId, data) {
  return api.post(`/projects/${projectId}/funding`, data).then((res) => res.data);
}
