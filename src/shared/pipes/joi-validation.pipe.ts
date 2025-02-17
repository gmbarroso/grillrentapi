import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException, Logger } from '@nestjs/common';
import { ObjectSchema } from '@hapi/joi';

@Injectable()
export class JoiValidationPipe implements PipeTransform {
  private readonly logger = new Logger(JoiValidationPipe.name);

  constructor(private schema: ObjectSchema) {}
  
  transform(value: any, metadata: ArgumentMetadata) {
    this.logger.log(`Validating value: ${JSON.stringify(value)}`);
    const { error } = this.schema.validate(value);
    if (error) {
      this.logger.error(`Validation failed: ${error.message}`);
      throw new BadRequestException('Validation failed');
    }
    return value;
  }
}
