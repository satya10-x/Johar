import { Schema } from 'mongoose';

export function geoLocationField() {
  const schema = new Schema(
    {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
      },
    },
    { _id: false }
  );

  schema.pre('validate', function normalize(next) {
    const coords = this.coordinates;
    const valid =
      Array.isArray(coords) &&
      coords.length === 2 &&
      coords.every((n) => typeof n === 'number');

    if (valid) {
      this.type = 'Point';
    } else {
      this.type = undefined;
      this.coordinates = undefined;
    }
    next();
  });

  return schema;
}

export default geoLocationField;
