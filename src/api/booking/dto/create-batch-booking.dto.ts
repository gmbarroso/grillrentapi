export class BatchBookingSlotDto {
  startTime!: Date;
  endTime!: Date;
}

export class CreateBatchBookingDto {
  resourceId!: string;
  slots!: BatchBookingSlotDto[];
  needTablesAndChairs?: boolean;
  bookedOnBehalf?: string;
}
