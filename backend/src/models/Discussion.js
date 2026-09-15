import mongoose from 'mongoose';

import geoLocationField from '../utils/geoLocation.js';
import { CHALLENGE_CATEGORIES } from './Challenge.js';

const { Schema } = mongoose;

export const DISCUSSION_STATUSES = ['active', 'closed', 'archived'];

export const REPORT_REASONS = [
  'spam',
  'abuse',
  'misinformation',
  'inappropriate_content',
  'other',
];

export const DISCUSSION_LANGUAGES = [
  'en', 'hi', 'bn', 'od', 'san', 'nag', 'kur', 'ho', 'mundari',
];

const commentSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

const reportSchema = new Schema(
  {
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true,
    },
    details: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

const discussionSchema = new Schema(
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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // exact coordinates are used only for nearby discovery — never returned publicly
    location: geoLocationField(),
    district: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    relatedChallenge: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
      index: true,
    },
    category: {
      type: String,
      enum: CHALLENGE_CATEGORIES,
      required: true,
      index: true,
    },
    radius: {
      type: Number,
      enum: [1, 5, 10, 25],
      default: 5,
    },
    language: {
      type: String,
      enum: DISCUSSION_LANGUAGES,
      default: 'en',
    },
    comments: [commentSchema],
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    participantCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: DISCUSSION_STATUSES,
      default: 'active',
      index: true,
    },
    reports: [reportSchema],
  },
  {
    timestamps: true,
  }
);

discussionSchema.index({ location: '2dsphere' });
discussionSchema.index({ district: 1, category: 1, status: 1 });
discussionSchema.index({ createdAt: -1 });

// roles that can moderate discussions
export const MODERATOR_ROLES = ['admin'];

export default mongoose.model('Discussion', discussionSchema);
