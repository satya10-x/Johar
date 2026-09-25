import api from './api.js';

export function getGovernmentProjects(params = {}) {
  return api.get('/government/projects', { params }).then((res) => res.data);
}

export function assignProjectAuthority(projectId, data) {
  return api.patch(`/government/projects/${projectId}/assign-authority`, data).then((res) => res.data);
}

export function getGovernmentMilestones(params = {}) {
  return api.get('/government/milestones', { params }).then((res) => res.data);
}

export function getGovernmentEscalations(params = {}) {
  return api.get('/government/escalations', { params }).then((res) => res.data);
}

export function createGovernmentEscalation(data) {
  return api.post('/government/escalations', data).then((res) => res.data);
}

export function updateGovernmentEscalation(id, data) {
  return api.patch(`/government/escalations/${id}`, data).then((res) => res.data);
}

export function scanGovernmentEscalations() {
  return api.post('/government/escalations/scan').then((res) => res.data);
}

export function getGovernmentAtRisk() {
  return api.get('/government/at-risk').then((res) => res.data);
}

export function getGovernmentAudit(params = {}) {
  return api.get('/government/audit', { params }).then((res) => res.data);
}

export function getGovernmentHierarchy(params = {}) {
  return api.get('/government/hierarchy', { params }).then((res) => res.data);
}

export function getChallengeAuthorityInfo(challengeId) {
  return api.get(`/government/challenges/${challengeId}/authority`).then((res) => res.data);
}
