import mongoose from 'mongoose';

const { Schema } = mongoose;

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const RISK_FACTOR_TYPES = [
  'schedule',
  'milestone',
  'evidence',
  'verification',
  'dependency',
  'collaboration',
  'budget',
  'general',
];

const riskFactorSchema = new Schema(
  {
    type: {
      type: String,
      enum: RISK_FACTOR_TYPES,
      default: 'general',
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    explanation: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const projectRiskAssessmentSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    riskLevel: {
      type: String,
      enum: RISK_LEVELS,
      required: true,
      index: true,
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    summary: {
      type: String,
      trim: true,
    },
    riskFactors: {
      type: [riskFactorSchema],
      default: [],
    },
    recommendedActions: {
      type: [String],
      default: [],
    },
    missingInformation: {
      type: [String],
      default: [],
    },
    progressAtAssessment: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    analysisVersion: {
      type: String,
      default: 'v1-groq',
    },
    isAiGenerated: {
      type: Boolean,
      default: true,
    },
    signals: {
      type: Schema.Types.Mixed,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

projectRiskAssessmentSchema.index({ project: 1, generatedAt: -1 });
projectRiskAssessmentSchema.index({ riskLevel: 1 });

export default mongoose.model('ProjectRiskAssessment', projectRiskAssessmentSchema);
