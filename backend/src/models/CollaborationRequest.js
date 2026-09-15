import mongoose from 'mongoose';

const { Schema } = mongoose;

export const COLLABORATION_TYPES = [
  'mentorship',
  'funding',
  'hardware',
  'software',
  'prototyping',
  'testing',
  'manufacturing',
  'deployment',
  'technology_transfer',
];

export const COLLABORATION_STATUSES = ['pending', 'accepted', 'rejected', 'needs_more_information'];

const collaborationRequestSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    industry: {
      type: Schema.Types.ObjectId,
      ref: 'Industry',
      required: true,
      index: true,
    },
    collaborationType: {
      type: String,
      enum: COLLABORATION_TYPES,
      required: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    proposedContribution: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    estimatedAmount: {
      amount: {
        type: Number,
        min: 0,
      },
      currency: {
        type: String,
        default: 'INR',
      },
    },
    status: {
      type: String,
      enum: COLLABORATION_STATUSES,
      default: 'pending',
      index: true,
    },
    responseMessage: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    respondedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

collaborationRequestSchema.index({ project: 1, industry: 1, collaborationType: 1 });

export default mongoose.model('CollaborationRequest', collaborationRequestSchema);
