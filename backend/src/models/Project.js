import mongoose from 'mongoose';

import geoLocationField from '../utils/geoLocation.js';

const { Schema } = mongoose;

export const PROJECT_STATUSES = [
  'proposed',
  'approved',
  'team_formation',
  'development',
  'testing',
  'pilot',
  'deployed',
  'completed',
  'cancelled',
];

// flexible before/after measurement, e.g.
// { metric: "Water Availability", unit: "hours/day", before: 2, after: 6 }
const impactMetricSchema = new Schema(
  {
    metric: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    unit: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    before: {
      type: Number,
    },
    after: {
      type: Number,
    },
  },
  { _id: false }
);

// all impact fields are optional — different projects report different kinds of impact
const impactSchema = new Schema(
  {
    peopleBenefited: {
      type: Number,
      min: 0,
      default: undefined,
    },
    householdsBenefited: {
      type: Number,
      min: 0,
      default: undefined,
    },
    districtsCovered: [{ type: String, trim: true }],
    villagesCovered: {
      type: Number,
      min: 0,
      default: undefined,
    },
    metrics: [impactMetricSchema],
    communitySatisfaction: {
      type: Number,
      min: 0,
      max: 100,
      default: undefined,
    },
    implementationCost: {
      type: Number,
      min: 0,
      default: undefined,
    },
    estimatedSavings: {
      type: Number,
      min: 0,
      default: undefined,
    },
    jobsCreated: {
      type: Number,
      min: 0,
      default: undefined,
    },
    incomeImprovement: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    timeSaved: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    resourcesSaved: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    environmentalImpact: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    // human-written summary; aiSummary is clearly labelled as AI-assisted
    impactSummary: {
      type: String,
      maxlength: 2000,
    },
    aiSummary: {
      type: String,
      maxlength: 2000,
    },
    aiSummaryGeneratedAt: {
      type: Date,
    },
    impactScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    scoreComputedAt: {
      type: Date,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { _id: false }
);

const projectSchema = new Schema(
  {    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    challenge: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
      required: true,
      index: true,
    },
    university: {
      type: Schema.Types.ObjectId,
      ref: 'University',
      index: true,
    },
    industryPartners: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Industry',
      },
    ],
    teamMembers: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          trim: true,
        },
      },
    ],
    facultyMentor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: 'proposed',
      index: true,
    },
    objectives: [{ type: String }],
    proposedSolution: {
      type: String,
      trim: true,
    },
    estimatedBudget: {
      amount: {
        type: Number,
        min: 0,
        default: 0,
      },
      currency: {
        type: String,
        default: 'INR',
      },
    },
    actualBudget: {
      amount: {
        type: Number,
        min: 0,
        default: 0,
      },
      currency: {
        type: String,
        default: 'INR',
      },
    },
    startDate: {
      type: Date,
    },
    expectedEndDate: {
      type: Date,
    },
    completionDate: {
      type: Date,
    },
    currentProgress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    technologies: [{ type: String }],
    outcomes: [{ type: String }],
    deploymentDetails: {
      description: {
        type: String,
        trim: true,
      },
      district: {
        type: String,
        trim: true,
        index: true,
      },
      location: geoLocationField(),
    },
    industryMatches: {
      type: Schema.Types.Mixed,
    },
    impact: {
      type: impactSchema,
      default: undefined,
    },
    governmentOwnership: {
      department: {
        type: String,
        trim: true,
      },
      authorityLevel: {
        type: String,
        enum: ['state', 'district', 'block', 'local_body', 'department'],
      },
      assignedAuthority: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      state: {
        type: String,
        trim: true,
        default: 'Jharkhand',
      },
      district: {
        type: String,
        trim: true,
      },
      block: {
        type: String,
        trim: true,
      },
      localBody: {
        type: String,
        trim: true,
      },
      assignedAt: {
        type: Date,
      },
      assignedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      notes: {
        type: String,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ status: 1, university: 1 });
projectSchema.index({ 'deploymentDetails.location': '2dsphere' });
projectSchema.index({ 'governmentOwnership.district': 1 });
projectSchema.index({ 'governmentOwnership.department': 1 });

export default mongoose.model('Project', projectSchema);
