import asyncHandler from '../utils/asyncHandler.js';
import {
  getDashboardSummary,
  getChallengeAnalytics,
  getPriorityChallenges,
  getUniversityAnalytics,
  getIndustryAnalytics,
  getProjectAnalytics,
  getFundingAnalytics,
  getCommunityAnalytics,
  getDistrictOverview,
  getImpactOverview,
  getRecentActivity,
} from '../services/adminAnalytics.service.js';

export const dashboard = asyncHandler(async (req, res) => {
  const district = req.query.district;
  const [summary, activity, impact] = await Promise.all([
    getDashboardSummary(district),
    getRecentActivity(district),
    getImpactOverview(),
  ]);
  res.json({
    success: true,
    ...summary,
    recentActivity: activity.activities,
    impact,
  });
});

export const challengeAnalytics = asyncHandler(async (req, res) => {
  const data = await getChallengeAnalytics(req.query.district);
  res.json({ success: true, ...data });
});

export const priorityChallenges = asyncHandler(async (req, res) => {
  const data = await getPriorityChallenges(req.query);
  res.json({ success: true, ...data });
});

export const universityAnalytics = asyncHandler(async (req, res) => {
  const data = await getUniversityAnalytics();
  res.json({ success: true, ...data });
});

export const industryAnalytics = asyncHandler(async (req, res) => {
  const data = await getIndustryAnalytics();
  res.json({ success: true, ...data });
});

export const projectAnalytics = asyncHandler(async (req, res) => {
  const data = await getProjectAnalytics(req.query.district);
  res.json({ success: true, ...data });
});

export const fundingAnalytics = asyncHandler(async (req, res) => {
  const data = await getFundingAnalytics(req.query.district);
  res.json({ success: true, ...data });
});

export const communityAnalytics = asyncHandler(async (req, res) => {
  const data = await getCommunityAnalytics(req.query.district);
  res.json({ success: true, ...data });
});

export const districtAnalytics = asyncHandler(async (req, res) => {
  const data = await getDistrictOverview();
  res.json({ success: true, ...data });
});
