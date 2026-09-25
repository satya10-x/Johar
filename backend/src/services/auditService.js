import AuditLog from '../models/AuditLog.js';

/**
 * Records an entry in the governance audit trail.
 */
export async function logGovernanceAction({
  actor,
  action,
  entityType,
  entityId,
  entityTitle,
  oldValue,
  newValue,
  notes,
}) {
  try {
    return await AuditLog.create({
      actor: actor?._id || actor,
      actorName: actor?.name || 'System / Official',
      actorRole: actor?.role || 'system',
      action,
      entityType,
      entityId,
      entityTitle: entityTitle || undefined,
      oldValue,
      newValue,
      notes: notes ? String(notes).trim() : undefined,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('AuditLog warning: failed to log action:', err.message);
    return null;
  }
}

/**
 * Retrieves audit logs with optional filters and pagination.
 */
export async function listAuditLogs({
  entityType,
  entityId,
  actorId,
  action,
  limit = 25,
  page = 1,
} = {}) {
  const query = {};
  if (entityType) query.entityType = entityType;
  if (entityId) query.entityId = entityId;
  if (actorId) query.actor = actorId;
  if (action) query.action = action;

  const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const parsedPage = Math.max(1, Number(page) || 1);
  const skip = (parsedPage - 1) * parsedLimit;

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('actor', 'name role department authorityLevel district')
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      total,
      page: parsedPage,
      pages: Math.ceil(total / parsedLimit) || 1,
      limit: parsedLimit,
    },
  };
}
