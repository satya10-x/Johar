import api from './api.js';

export function submitMilestoneForVerification(milestoneId, notes = '') {
  return api
    .post(`/milestones/${milestoneId}/submit-for-verification`, { notes })
    .then((res) => res.data);
}

export function getMilestoneEvidence(milestoneId) {
  return api.get(`/milestones/${milestoneId}/evidence`).then((res) => res.data);
}

export function addMilestoneEvidence(milestoneId, data) {
  return api.post(`/milestones/${milestoneId}/evidence`, data).then((res) => res.data);
}

export function verifyMilestone(milestoneId, notes = '') {
  return api.post(`/milestones/${milestoneId}/verify`, { notes }).then((res) => res.data);
}

export function requestMilestoneChanges(milestoneId, notes) {
  return api.post(`/milestones/${milestoneId}/request-changes`, { notes }).then((res) => res.data);
}

export function rejectMilestone(milestoneId, notes) {
  return api.post(`/milestones/${milestoneId}/reject`, { notes }).then((res) => res.data);
}
