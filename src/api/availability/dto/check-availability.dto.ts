import * as Joi from '@hapi/joi';

export const CheckAvailabilitySchema = Joi.object({
  resourceId: Joi.string().required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().required(),
});

export class CheckAvailabilityDto {
  resourceId: string;
  startTime: Date;
  endTime: Date;
}
