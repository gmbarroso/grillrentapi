import { Injectable } from '@nestjs/common';

@Injectable()
export class AvailabilityService {
  private availabilities: { resourceId: string }[] = [];

  async findByResource(resourceId: string) {
    return this.availabilities.filter(availability => 
        availability.resourceId === resourceId
    );
  }
}
