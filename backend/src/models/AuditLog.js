import mongoose from 'mongoose';

const { Schema } = mongoose;

export const AUDIT_ACTIONS = [
  'assignment',
  'milestone_submission',
  'evidence_upload',
  'verification',
  'rejection',
  'changes_requested',
  'escalation_created',
  'escalation_acknowledged',
  'escalation_resolved',
  'escalation_dismissed',
  'escalation_level_advanced',
  'status_change',
];

const auditLogSchema = new Schema(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorName: {
      type: String,
      trim: true,
    },
    actorRole: {
      type: String,
      trim: true,
    },
    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['Project', 'Milestone', 'Escalation', 'Challenge', 'User'],
      required: true,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    entityTitle: {
      type: String,
      trim: true,
    },
    oldValue: {
      type: Schema.Types.Mixed,
    },
    newValue: {
      type: Schema.Types.Mixed,
    },
    notes: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
