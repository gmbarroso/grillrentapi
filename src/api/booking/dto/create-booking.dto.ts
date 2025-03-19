import * as Joi from '@hapi/joi';

export const CreateBookingSchema = Joi.object({
  resourceId: Joi.string().required(),
  userId: Joi.string().required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().required(),
  needTablesAndChairs: Joi.boolean().required(),
  bookedOnBehalf: Joi.string().optional(),
});

export class CreateBookingDto {
  resourceId!: string;
  userId!: string;
  startTime!: Date;
  endTime!: Date;
  needTablesAndChairs!: boolean;
  bookedOnBehalf?: string;
}
