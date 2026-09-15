import mongoose from 'mongoose';

const { Schema } = mongoose;

export const FUNDING_STATUSES = [
  'proposed',
  'committed',
  'approved',
  'completed',
  'cancelled',
];

const fundingSchema = new Schema(
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
    amount: {
      type: Number,
      required: true,
      min: [1, 'Funding amount must be greater than zero'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: FUNDING_STATUSES,
      default: 'proposed',
      index: true,
    },
    purpose: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

fundingSchema.index({ project: 1, industry: 1, status: 1 });

export default mongoose.model('Funding', fundingSchema);
