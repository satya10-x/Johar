import mongoose from 'mongoose';

const { Schema } = mongoose;

export const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'delayed'];

const milestoneSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    completedDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: MILESTONE_STATUSES,
      default: 'pending',
      index: true,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    deliverables: [{ type: String }],
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

milestoneSchema.index({ project: 1, dueDate: 1 });

export default mongoose.model('Milestone', milestoneSchema);
