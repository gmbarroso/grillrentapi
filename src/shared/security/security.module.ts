import { Global, Module } from '@nestjs/common';
import { SecurityObservabilityService } from './security-observability.service';

@Global()
@Module({
  providers: [SecurityObservabilityService],
  exports: [SecurityObservabilityService],
})
export class SecurityModule {}
