import * as Joi from '@hapi/joi';

export class BatchBookingSlotDto {
  startTime!: string;
  endTime!: string;
}

export class CreateBatchBookingDto {
  resourceId!: string;
  slots!: BatchBookingSlotDto[];
  needTablesAndChairs?: boolean;
  bookedOnBehalf?: string;
}

export const BatchBookingSlotSchema = Joi.object({
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
});

export const CreateBatchBookingSchema = Joi.object({
  resourceId: Joi.string().required(),
  slots: Joi.array().items(BatchBookingSlotSchema).min(1).max(50).required(),
  needTablesAndChairs: Joi.boolean().optional(),
  bookedOnBehalf: Joi.string().trim().max(50).optional(),
});
