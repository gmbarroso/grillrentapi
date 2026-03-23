import * as Joi from '@hapi/joi';

export class CompleteFirstAccessTourDto {
  version!: number;
}

export const CompleteFirstAccessTourSchema = Joi.object({
  version: Joi.number().integer().min(1).required(),
});

export interface UserTourStateDto {
  firstAccessTourVersionCompleted: number | null;
}
