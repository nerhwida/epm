import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    organization: { type: String, default: "" },
    position: { type: String, default: "" },
    name: { type: String, default: "" },
    subject: { type: String, default: "" },
    term: { type: String, default: "" },
    prev_position: { type: String, default: "" },
    prev_org: { type: String, default: "" },
    appointment_date: { type: String, default: "" },
    raw_text: { type: String, default: "" },
    parse_status: {
      type: String,
      enum: ["parsed", "needs_review", "manual"],
      default: "needs_review",
    },
    parse_confidence: { type: Number, default: 0 },
    parse_warnings: { type: [String], default: [] },
    memo: { type: String, default: "" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

appointmentSchema.index({ name: 1 });
appointmentSchema.index({ organization: 1 });
appointmentSchema.index({ subject: 1 });
appointmentSchema.index({ appointment_date: 1 });
appointmentSchema.index({ prev_org: 1 });

export const Appointment = mongoose.model("Appointment", appointmentSchema);
