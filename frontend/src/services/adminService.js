import api from './api.js';

export function getAdminDashboard(params = {}) {
  return api.get('/admin/dashboard', { params }).then((res) => res.data);
}

export function getChallengeAnalytics(params = {}) {
  return api.get('/admin/analytics/challenges', { params }).then((res) => res.data);
}

export function getPriorityChallenges(params = {}) {
  return api.get('/admin/analytics/priority-challenges', { params }).then((res) => res.data);
}

export function getUniversityAnalytics() {
  return api.get('/admin/analytics/universities').then((res) => res.data);
}

export function getIndustryAnalytics() {
  return api.get('/admin/analytics/industries').then((res) => res.data);
}

export function getProjectAnalytics(params = {}) {
  return api.get('/admin/analytics/projects', { params }).then((res) => res.data);
}

export function getFundingAnalytics(params = {}) {
  return api.get('/admin/analytics/funding', { params }).then((res) => res.data);
}

export function getCommunityAnalytics(params = {}) {
  return api.get('/admin/analytics/community', { params }).then((res) => res.data);
}

export function getDistrictAnalytics() {
  return api.get('/admin/analytics/districts').then((res) => res.data);
}
