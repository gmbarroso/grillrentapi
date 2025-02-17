import { JoiValidationPipe } from './joi-validation.pipe';
import * as Joi from '@hapi/joi';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';

describe('JoiValidationPipe', () => {
  let pipe: JoiValidationPipe;
  let schema: Joi.ObjectSchema;

  beforeEach(() => {
    schema = Joi.object({
      name: Joi.string().required(),
      password: Joi.string().min(8).required(),
    });
    pipe = new JoiValidationPipe(schema);
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should validate and return the value if valid', () => {
    const value = { name: 'testuser', password: 'password' }; // 8 characters
    const metadata: ArgumentMetadata = { type: 'body', metatype: Object, data: '' };

    expect(pipe.transform(value, metadata)).toEqual(value);
  });

  it('should throw a BadRequestException if validation fails', () => {
    const value = { name: 'testuser', password: 'short' }; // less than 8 characters
    const metadata: ArgumentMetadata = { type: 'body', metatype: Object, data: '' };

    expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
  });
});
