import mongoose from 'mongoose';

const { Schema } = mongoose;

export const VALIDATION_TYPES = ['support', 'dispute', 'comment'];

const communityValidationSchema = new Schema(
  {
    challenge: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: VALIDATION_TYPES,
      required: true,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    evidence: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

communityValidationSchema.index({ challenge: 1, user: 1, type: 1 }, { unique: true });
communityValidationSchema.index({ createdAt: -1 });

export default mongoose.model('CommunityValidation', communityValidationSchema);
