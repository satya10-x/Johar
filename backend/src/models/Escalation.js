import mongoose from 'mongoose';

const { Schema } = mongoose;

export const ESCALATION_TRIGGERS = [
  'milestone_overdue',
  'project_overdue',
  'progress_behind',
  'repeated_changes_requested',
  'missing_evidence',
  'milestone_blocked',
  'unresolved_dependency',
  'high_priority_delayed',
  'manual',
];

export const ESCALATION_LEVELS = [
  'local_body',
  'block',
  'district',
  'state',
  'department',
];

export const ESCALATION_STATUSES = [
  'open',
  'acknowledged',
  'resolved',
  'dismissed',
];

const escalationSchema = new Schema(
  {
    challenge: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    milestone: {
      type: Schema.Types.ObjectId,
      ref: 'Milestone',
      index: true,
    },
    trigger: {
      type: String,
      enum: ESCALATION_TRIGGERS,
      required: true,
      index: true,
    },
    currentLevel: {
      type: String,
      enum: ESCALATION_LEVELS,
      required: true,
      index: true,
    },
    escalatedTo: {
      type: String,
      enum: ESCALATION_LEVELS,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ESCALATION_STATUSES,
      default: 'open',
      index: true,
    },
    daysOverdue: {
      type: Number,
      default: 0,
    },
    acknowledgedAt: {
      type: Date,
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolutionNotes: {
      type: String,
      trim: true,
    },
    history: [
      {
        action: { type: String },
        fromLevel: { type: String },
        toLevel: { type: String },
        performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        notes: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

escalationSchema.pre('validate', function (next) {
  if (!this.project && !this.challenge) {
    this.invalidate('project', 'Either project or challenge is required for escalation');
  }
  next();
});

escalationSchema.index({ status: 1, currentLevel: 1 });
escalationSchema.index({ project: 1, trigger: 1, status: 1 });
escalationSchema.index({ challenge: 1, status: 1 });

export default mongoose.model('Escalation', escalationSchema);
