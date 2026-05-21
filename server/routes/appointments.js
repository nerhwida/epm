import { Router } from "express";
import { Appointment } from "../models/Appointment.js";

export const appointmentsRouter = Router();

const TEXT_FIELDS = ["name", "organization", "subject", "appointment_date", "prev_org"];
const SORT_FIELDS = new Set([
  "organization",
  "position",
  "name",
  "subject",
  "term",
  "prev_position",
  "prev_org",
  "appointment_date",
]);
const WRITABLE_FIELDS = [
  "organization",
  "position",
  "name",
  "subject",
  "term",
  "prev_position",
  "prev_org",
  "appointment_date",
  "raw_text",
  "parse_status",
  "parse_confidence",
  "parse_warnings",
  "memo",
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pickWritableFields(body) {
  const picked = {};
  for (const field of WRITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      picked[field] = body[field];
    }
  }
  return picked;
}

function buildQuery(query) {
  const filters = {};
  for (const field of TEXT_FIELDS) {
    if (query[field]) {
      filters[field] = { $regex: escapeRegex(query[field]), $options: "i" };
    }
  }
  return filters;
}

function buildSort(query) {
  const sortBy = String(query.sort_by || "");
  if (!SORT_FIELDS.has(sortBy)) {
    return { appointment_date: -1, position: 1, organization: 1, name: 1 };
  }

  const direction = query.sort_order === "desc" ? -1 : 1;
  return { [sortBy]: direction, _id: 1 };
}

appointmentsRouter.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;
    const filters = buildQuery(req.query);
    const sort = buildSort(req.query);

    const [items, total] = await Promise.all([
      Appointment.find(filters)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Appointment.countDocuments(filters),
    ]);

    res.json({ items, page, limit, total, pages: Math.ceil(total / limit) || 1 });
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.post("/", async (req, res, next) => {
  try {
    const item = await Appointment.create(pickWritableFields(req.body || {}));
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.post("/bulk", async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: "저장할 데이터가 없습니다." });
    const result = await Appointment.insertMany(items.map((item) => pickWritableFields(item || {})));
    res.status(201).json({ inserted: result.length, items: result });
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.get("/:id", async (req, res, next) => {
  try {
    const item = await Appointment.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "데이터를 찾을 수 없습니다." });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.put("/:id", async (req, res, next) => {
  try {
    const item = await Appointment.findByIdAndUpdate(req.params.id, pickWritableFields(req.body || {}), {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ error: "데이터를 찾을 수 없습니다." });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.delete("/:id", async (req, res, next) => {
  try {
    const item = await Appointment.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "데이터를 찾을 수 없습니다." });
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});
