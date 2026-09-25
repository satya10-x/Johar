export const HIERARCHY_LEVELS = ['local_body', 'block', 'district', 'state'];

export const GOV_DEPARTMENTS = [
  'Rural Development',
  'Water Resources & PHED',
  'Health & Family Welfare',
  'Agriculture & Animal Husbandry',
  'School Education & Literacy',
  'Mines & Geology',
  'Forest, Environment & Climate Change',
  'Road Construction & Works',
  'Social Welfare & Women Child Development',
  'Urban Development & Housing',
  'Energy & Power',
  'Information Technology & e-Governance',
  'Higher & Technical Education',
  'Panchayati Raj',
];

export const CATEGORY_DEPARTMENT_MAP = {
  education: 'School Education & Literacy',
  healthcare: 'Health & Family Welfare',
  agriculture: 'Agriculture & Animal Husbandry',
  water: 'Water Resources & PHED',
  sanitation: 'Urban Development & Housing',
  environment: 'Forest, Environment & Climate Change',
  energy: 'Energy & Power',
  roads_infrastructure: 'Road Construction & Works',
  rural_livelihood: 'Rural Development',
  accessibility: 'Social Welfare & Women Child Development',
  public_services: 'Information Technology & e-Governance',
  waste_management: 'Urban Development & Housing',
  employment: 'Rural Development',
  other: 'Panchayati Raj',
};

/**
 * Returns a standardized representation of a user's governance authority scope.
 */
export function getUserScope(user) {
  if (!user) return { role: 'anonymous', isUnrestricted: false, level: null };

  if (user.role === 'admin') {
    return {
      role: 'admin',
      isUnrestricted: true,
      level: 'state',
      state: 'Jharkhand',
      district: user.district || null,
      block: user.block || null,
      localBody: user.localBody || null,
      department: user.department || null,
    };
  }

  if (user.role === 'government') {
    const level = user.authorityLevel || (user.district ? 'district' : 'state');
    return {
      role: 'government',
      isUnrestricted: level === 'state',
      level,
      state: user.state || 'Jharkhand',
      district: user.district || null,
      block: user.block || null,
      localBody: user.localBody || null,
      department: user.department || null,
    };
  }

  return {
    role: user.role,
    isUnrestricted: false,
    level: null,
    district: user.district || null,
  };
}

/**
 * Builds a MongoDB filter for Project queries based on government user scope.
 */
export function buildProjectScopeFilter(user, additionalFilters = {}) {
  const scope = getUserScope(user);

  if (scope.isUnrestricted || scope.role === 'admin') {
    return { ...additionalFilters };
  }

  if (scope.role !== 'government') {
    return { ...additionalFilters };
  }

  const scopeConditions = [];

  switch (scope.level) {
    case 'state':
      // State-level sees all projects across the state
      break;

    case 'district':
      if (scope.district) {
        scopeConditions.push(
          { 'governmentOwnership.district': { $regex: new RegExp(`^${scope.district}$`, 'i') } },
          { 'deploymentDetails.district': { $regex: new RegExp(`^${scope.district}$`, 'i') } }
        );
      }
      break;

    case 'block':
      if (scope.block) {
        scopeConditions.push({
          'governmentOwnership.block': { $regex: new RegExp(`^${scope.block}$`, 'i') },
        });
      }
      break;

    case 'local_body':
      if (scope.localBody) {
        scopeConditions.push({
          'governmentOwnership.localBody': { $regex: new RegExp(`^${scope.localBody}$`, 'i') },
        });
      }
      break;

    case 'department':
      if (scope.department) {
        scopeConditions.push({
          'governmentOwnership.department': { $regex: new RegExp(`^${scope.department}$`, 'i') },
        });
      }
      break;

    default:
      if (scope.district) {
        scopeConditions.push(
          { 'governmentOwnership.district': { $regex: new RegExp(`^${scope.district}$`, 'i') } },
          { 'deploymentDetails.district': { $regex: new RegExp(`^${scope.district}$`, 'i') } }
        );
      }
      break;
  }

  const query = { ...additionalFilters };

  if (scopeConditions.length === 1) {
    Object.assign(query, scopeConditions[0]);
  } else if (scopeConditions.length > 1) {
    query.$or = scopeConditions;
  }

  return query;
}

/**
 * Checks if a user is authorized to view a project's governance details.
 */
export function canViewProject(user, project) {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const scope = getUserScope(user);
  if (scope.isUnrestricted || scope.level === 'state') return true;

  if (scope.role === 'government') {
    const projDistrict = project.governmentOwnership?.district || project.deploymentDetails?.district;
    if (scope.level === 'district' && scope.district) {
      return !projDistrict || projDistrict.toLowerCase() === scope.district.toLowerCase();
    }
    if (scope.level === 'block' && scope.block) {
      return (
        !project.governmentOwnership?.block ||
        project.governmentOwnership.block.toLowerCase() === scope.block.toLowerCase()
      );
    }
    if (scope.level === 'local_body' && scope.localBody) {
      return (
        !project.governmentOwnership?.localBody ||
        project.governmentOwnership.localBody.toLowerCase() === scope.localBody.toLowerCase()
      );
    }
    if (scope.level === 'department' && scope.department) {
      return (
        !project.governmentOwnership?.department ||
        project.governmentOwnership.department.toLowerCase() === scope.department.toLowerCase()
      );
    }
    return true;
  }

  const userIdStr = user._id ? user._id.toString() : '';

  // University owner / creator / mentor
  const uniIdStr = project.university ? (project.university._id || project.university).toString() : '';
  if (uniIdStr && (uniIdStr === userIdStr || project.university?.createdBy?.toString() === userIdStr)) {
    return true;
  }

  if (project.mentor && (project.mentor._id || project.mentor).toString() === userIdStr) {
    return true;
  }

  // Team member
  const isMember = project.teamMembers?.some(
    (tm) => (tm.user?._id || tm.user)?.toString() === userIdStr
  );
  if (isMember) return true;

  // University or faculty roles
  if (['university', 'faculty'].includes(user.role)) {
    return true;
  }

  // Industry role
  if (user.role === 'industry') {
    return true;
  }

  return false;
}

/**
 * Checks if a user is authorized to assign or update government ownership on a project.
 */
export function canAssignAuthority(user, project) {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const scope = getUserScope(user);
  if (scope.role !== 'government') return false;

  // State officials can assign any project; District officials can assign within their district
  if (scope.level === 'state') return true;

  const projDistrict = project.governmentOwnership?.district || project.deploymentDetails?.district;
  if (scope.level === 'district' && scope.district) {
    return projDistrict && projDistrict.toLowerCase() === scope.district.toLowerCase();
  }

  return false;
}

/**
 * Checks if a user is authorized to verify a milestone.
 * Only government officials with appropriate authority scope or admins can verify.
 */
export function canVerifyMilestone(user, milestone, project) {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const scope = getUserScope(user);
  if (scope.role !== 'government') return false;

  if (scope.level === 'state') return true;

  const projDistrict = project.governmentOwnership?.district || project.deploymentDetails?.district;

  if (scope.level === 'district') {
    return !projDistrict || projDistrict.toLowerCase() === (scope.district || '').toLowerCase();
  }

  if (scope.level === 'block') {
    return (
      project.governmentOwnership?.block &&
      project.governmentOwnership.block.toLowerCase() === (scope.block || '').toLowerCase()
    );
  }

  if (scope.level === 'local_body') {
    return (
      project.governmentOwnership?.localBody &&
      project.governmentOwnership.localBody.toLowerCase() === (scope.localBody || '').toLowerCase()
    );
  }

  if (scope.level === 'department') {
    return (
      project.governmentOwnership?.department &&
      project.governmentOwnership.department.toLowerCase() === (scope.department || '').toLowerCase()
    );
  }

  return true;
}

/**
 * Checks if a user can review, request changes, or reject a milestone.
 */
export function canReviewMilestone(user, milestone, project) {
  return canVerifyMilestone(user, milestone, project);
}

/**
 * Checks if a user can submit a milestone for verification or add completion evidence.
 */
export function canSubmitMilestoneEvidence(user, project) {
  if (!user) return false;
  if (user.role === 'admin') return true;

  // University owner
  if (project.university && project.university.toString() === user._id?.toString()) {
    return true;
  }

  // Faculty mentor
  if (project.facultyMentor && project.facultyMentor.toString() === user._id?.toString()) {
    return true;
  }

  // Team member
  const isMember = project.teamMembers?.some(
    (tm) => tm.user?.toString() === user._id?.toString()
  );
  if (isMember) return true;

  // Government officials can also add inspection evidence notes
  if (user.role === 'government') return true;

  return false;
}

/**
 * Checks if a user can acknowledge, resolve, or dismiss an escalation.
 */
export function canManageEscalation(user, escalation, project) {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const scope = getUserScope(user);
  if (scope.role !== 'government') return false;
  if (scope.level === 'state') return true;

  // Officials at or above the escalation's current level can manage it
  const levelRanks = { local_body: 1, block: 2, district: 3, state: 4, department: 3 };
  const userRank = levelRanks[scope.level] || 1;
  const escalationRank = levelRanks[escalation.escalatedTo || escalation.currentLevel] || 1;

  if (userRank < escalationRank) return false;

  // If district level, must match project district
  if (scope.level === 'district' && project) {
    const projDistrict = project.governmentOwnership?.district || project.deploymentDetails?.district;
    return !projDistrict || projDistrict.toLowerCase() === (scope.district || '').toLowerCase();
  }

  return true;
}
