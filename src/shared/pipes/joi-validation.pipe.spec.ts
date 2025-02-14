import { JoiValidationPipe } from './joi-validation.pipe';
import * as Joi from '@hapi/joi';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';

describe('JoiValidationPipe', () => {
  let pipe: JoiValidationPipe;
  let schema: Joi.ObjectSchema;

  beforeEach(() => {
    schema = Joi.object({
      username: Joi.string().required(),
      password: Joi.string().min(8).required(),
    });
    pipe = new JoiValidationPipe(schema);
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should validate and return the value if valid', () => {
    const value = { username: 'testuser', password: 'password123' };
    const metadata: ArgumentMetadata = { type: 'body', metatype: Object, data: '' };

    expect(pipe.transform(value, metadata)).toEqual(value);
  });

  it('should throw a BadRequestException if validation fails', () => {
    const value = { username: 'testuser', password: 'short' };
    const metadata: ArgumentMetadata = { type: 'body', metatype: Object, data: '' };

    expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
  });
});
