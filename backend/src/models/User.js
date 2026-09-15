import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import geoLocationField from '../utils/geoLocation.js';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[0-9+\-\s]{6,15}$/, 'Invalid phone number'],
    },
    password: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: ['citizen', 'student', 'faculty', 'university', 'industry', 'government', 'admin'],
      default: 'citizen',
      index: true,
    },
    profileImage: {
      type: String,
    },
    preferredLanguage: {
      type: String,
      default: 'en',
      enum: ['en', 'hi', 'bn', 'od', 'san', 'nag', 'kur', 'ho', 'mundari'],
    },
    district: {
      type: String,
      trim: true,
      index: true,
    },
    location: geoLocationField(),
    organization: {
      type: String,
      trim: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    interests: {
      type: [String],
      default: [],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ location: '2dsphere' });

export const USER_ROLES = userSchema.path('role').enumValues;
export const SELF_REGISTRATION_ROLES = ['citizen', 'student', 'faculty', 'university', 'industry'];

const SALT_ROUNDS = 10;

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toJSON();
  delete obj.password;
  delete obj.__v;
  return obj;
};

export default mongoose.model('User', userSchema);
