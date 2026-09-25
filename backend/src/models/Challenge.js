import mongoose from 'mongoose';

import geoLocationField from '../utils/geoLocation.js';

const { Schema } = mongoose;

export const CHALLENGE_STATUSES = [
  'submitted',
  'under_review',
  'validated',
  'assigned',
  'in_progress',
  'resolved',
  'rejected',
];

export const CHALLENGE_CATEGORIES = [
  'education',
  'healthcare',
  'agriculture',
  'water',
  'sanitation',
  'environment',
  'energy',
  'roads_infrastructure',
  'rural_livelihood',
  'accessibility',
  'public_services',
  'waste_management',
  'employment',
  'other',
];

const mediaSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
    },
    originalName: {
      type: String,
    },
  },
  { _id: false }
);

const similarChallengeSchema = new Schema(
  {
    challenge: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
    },
    title: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      trim: true,
    },
    distanceLabel: {
      type: String,
      trim: true,
    },
    similarity: {
      type: String,
      enum: ['high', 'medium', 'low'],
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  { _id: false }
);

const duplicateCheckSchema = new Schema(
  {
    checkedAt: {
      type: Date,
    },
    isDuplicate: {
      type: Boolean,
      default: false,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    similarChallenges: [similarChallengeSchema],
  },
  { _id: false }
);

const voiceInputSchema = new Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    audioUrl: {
      type: String,
    },
    originalTranscript: {
      type: String,
      trim: true,
    },
    originalLanguage: {
      type: String,
      trim: true,
    },
    standardizedText: {
      type: String,
      trim: true,
    },
    standardizedLanguage: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

export const AI_STATUSES = ['pending', 'processing', 'completed', 'failed'];

const challengeSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    category: {
      type: String,
      required: true,
      index: true,
      enum: CHALLENGE_CATEGORIES,
    },
    subCategory: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    images: [mediaSchema],
    videos: [mediaSchema],
    documents: [mediaSchema],
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    location: geoLocationField(),
    address: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    district: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    language: {
      type: String,
      default: 'en',
    },
    affectedPopulation: {
      type: Number,
      min: 0,
      default: 0,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    priorityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    status: {
      type: String,
      enum: CHALLENGE_STATUSES,
      default: 'submitted',
      index: true,
    },
    aiSummary: {
      type: String,
    },
    aiClassification: {
      type: Schema.Types.Mixed,
    },
    aiStatus: {
      type: String,
      enum: AI_STATUSES,
      default: 'pending',
      index: true,
    },
    aiAnalyzedAt: {
      type: Date,
    },
    aiError: {
      type: String,
    },
    skillsRequired: [{ type: String }],
    suggestedInstitutions: [
      {
        university: {
          type: Schema.Types.ObjectId,
          ref: 'University',
        },
        reason: {
          type: String,
          trim: true,
        },
      },
    ],
    assignedUniversity: {
      type: Schema.Types.ObjectId,
      ref: 'University',
    },
    universityResponses: [
      {
        university: {
          type: Schema.Types.ObjectId,
          ref: 'University',
        },
        response: {
          type: String,
          trim: true,
          maxlength: 2000,
        },
        interestLevel: {
          type: String,
          enum: ['interested', 'needs_more_information', 'not_interested'],
          required: true,
        },
        estimatedTimeline: {
          type: String,
          trim: true,
          maxlength: 120,
        },
        requiredResources: [{ type: String }],
        respondedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    universityMatches: {
      type: Schema.Types.Mixed,
    },
    communityValidation: {
      supportCount: {
        type: Number,
        min: 0,
        default: 0,
      },
      disputeCount: {
        type: Number,
        min: 0,
        default: 0,
      },
      commentCount: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    duplicateCheck: {
      type: duplicateCheckSchema,
      default: undefined,
    },
    voiceInput: {
      type: voiceInputSchema,
      default: undefined,
    },
    tags: [{ type: String, lowercase: true, trim: true }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

challengeSchema.virtual('communityValidationScore').get(function communityScore() {
  const { supportCount = 0, disputeCount = 0, commentCount = 0 } = this.communityValidation || {};
  const positive = supportCount + 0.5 * commentCount;
  const total = positive + disputeCount * 2 + 3;
  return Math.round((positive / total) * 100);
});

challengeSchema.index({ status: 1, category: 1 });
challengeSchema.index({ createdAt: -1 });
challengeSchema.index({ location: '2dsphere' });

export default mongoose.model('Challenge', challengeSchema);
