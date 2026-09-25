import mongoose from 'mongoose';

const { Schema } = mongoose;

export const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'delayed'];

export const MILESTONE_EXECUTION_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'delayed',
  'blocked',
];

export const MILESTONE_VERIFICATION_STATUSES = [
  'not_submitted',
  'submitted',
  'under_review',
  'verified',
  'changes_requested',
  'rejected',
];

export const EVIDENCE_TYPES = [
  'image',
  'video',
  'document',
  'report',
  'prototype_link',
  'field_measurement',
  'completion_notes',
  'other',
];

const evidenceSchema = new Schema(
  {
    type: {
      type: String,
      enum: EVIDENCE_TYPES,
      default: 'document',
    },
    url: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const milestoneSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    completedDate: {
      type: Date,
    },
    // Original milestone status preserved for backward compatibility
    status: {
      type: String,
      enum: MILESTONE_STATUSES,
      default: 'pending',
      index: true,
    },
    // Extended execution & governance verification statuses
    executionStatus: {
      type: String,
      enum: MILESTONE_EXECUTION_STATUSES,
      default: 'pending',
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: MILESTONE_VERIFICATION_STATUSES,
      default: 'not_submitted',
      index: true,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    deliverables: [{ type: String }],
    notes: {
      type: String,
      trim: true,
    },
    evidence: [evidenceSchema],
    verificationNotes: {
      type: String,
      trim: true,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: {
      type: Date,
    },
    blockedReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

milestoneSchema.index({ project: 1, dueDate: 1 });

export default mongoose.model('Milestone', milestoneSchema);
