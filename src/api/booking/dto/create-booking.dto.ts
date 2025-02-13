import * as Joi from '@hapi/joi';

export const CreateBookingSchema = Joi.object({
  resourceId: Joi.string().required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().required(),
});

export class CreateBookingDto {
  resourceId: string;
  startTime: Date;
  endTime: Date;
}
