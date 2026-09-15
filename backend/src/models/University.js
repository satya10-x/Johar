import mongoose from 'mongoose';

import geoLocationField from '../utils/geoLocation.js';

const { Schema } = mongoose;

const universitySchema = new Schema(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
    districtsCovered: [{ type: String, index: true }],
    departments: [{ type: String }],
    researchAreas: [{ type: String }],
    expertise: [{ type: String }],
    facilities: [{ type: String }],
    facultyMembers: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        department: {
          type: String,
          trim: true,
        },
        designation: {
          type: String,
          trim: true,
        },
      },
    ],
    studentCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    previousProjects: [
      {
        title: {
          type: String,
          required: true,
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
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

universitySchema.index({ location: '2dsphere' });

export default mongoose.model('University', universitySchema);
