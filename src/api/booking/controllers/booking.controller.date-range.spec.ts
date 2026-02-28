import { BookingController } from './booking.controller';

describe('BookingController date-range forwarding', () => {
  it('forwards startDate/endDate to service.findAll', async () => {
    const bookingService = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, lastPage: 0 }),
    };
    const controller = new BookingController(bookingService as any);

    await controller.findAll(1, 20, 'startTime', 'ASC', '2026-02-27', '2026-05-27');

    expect(bookingService.findAll).toHaveBeenCalledWith(1, 20, 'startTime', 'ASC', '2026-02-27', '2026-05-27');
  });
});
