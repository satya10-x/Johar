import api from './api.js';

export function getProject(id) {
  return api.get(`/projects/${id}`).then((res) => res.data);
}

export function listProjects(params = {}) {
  return api.get('/projects', { params }).then((res) => res.data);
}

export function createProject(data) {
  return api.post('/projects', data).then((res) => res.data);
}

export function updateProject(id, data) {
  return api.patch(`/projects/${id}`, data).then((res) => res.data);
}

export function changeStatus(id, status) {
  return api.patch(`/projects/${id}/status`, { status }).then((res) => res.data);
}

export function addTeamMember(id, userId, role) {
  return api.post(`/projects/${id}/team`, { userId, role }).then((res) => res.data);
}

export function removeTeamMember(id, userId) {
  return api.delete(`/projects/${id}/team/${userId}`).then((res) => res.data);
}

export function assignMentor(id, userId) {
  return api.patch(`/projects/${id}/mentor`, { userId }).then((res) => res.data);
}

export function getMilestones(id) {
  return api.get(`/projects/${id}/milestones`).then((res) => res.data);
}

export function createMilestone(id, data) {
  return api.post(`/projects/${id}/milestones`, data).then((res) => res.data);
}

export function updateMilestone(milestoneId, data) {
  return api.patch(`/milestones/${milestoneId}`, data).then((res) => res.data);
}

export function deleteMilestone(milestoneId) {
  return api.delete(`/milestones/${milestoneId}`).then((res) => res.data);
}

// industry collaboration
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

// ---------- social impact ----------

export function getProjectImpact(id) {
  return api.get(`/projects/${id}/impact`).then((res) => res.data);
}

export function createImpact(id, data) {
  return api.post(`/projects/${id}/impact`, data).then((res) => res.data);
}

export function updateImpact(id, data) {
  return api.patch(`/projects/${id}/impact`, data).then((res) => res.data);
}

export function generateImpactSummary(id) {
  return api.post(`/projects/${id}/impact/summary`).then((res) => res.data);
}

export function getReplicationOpportunities(id) {
  return api.get(`/projects/${id}/replication-opportunities`).then((res) => res.data);
}
