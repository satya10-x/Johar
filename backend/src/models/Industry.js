import mongoose from 'mongoose';

import geoLocationField from '../utils/geoLocation.js';

const { Schema } = mongoose;

export const COMPANY_TYPES = [
  'startup',
  'MSME',
  'corporate',
  'CSR',
  'research_organization',
  'innovation_hub',
];

const industrySchema = new Schema(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    companyType: {
      type: String,
      enum: COMPANY_TYPES,
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    logo: {
      type: String,
    },
    location: geoLocationField(),
    address: {
      type: String,
      trim: true,
    },
    industries: [{ type: String }],
    expertise: [{ type: String }],
    technologies: [{ type: String }],
    collaborationTypes: [
      {
        type: String,
        enum: [
          'sponsorship',
          'mentorship',
          'internships',
          'pilot_deployment',
          'research_collaboration',
          'csr_funding',
        ],
      },
    ],
    fundingCapacity: {
      min: {
        type: Number,
        min: 0,
      },
      max: {
        type: Number,
        min: 0,
      },
      currency: {
        type: String,
        default: 'INR',
      },
    },
    previousCollaborations: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
        },
        partner: {
          type: String,
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        year: {
          type: Number,
        },
      },
    ],
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
    contactInformation: {
      email: {
        type: String,
        lowercase: true,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      website: {
        type: String,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

industrySchema.index({ location: '2dsphere' });

export default mongoose.model('Industry', industrySchema);
