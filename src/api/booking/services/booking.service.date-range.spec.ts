import { BadRequestException } from '@nestjs/common';
import { BookingService } from './booking.service';

describe('BookingService date-range filtering', () => {
  const queryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const bookingRepository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const resourceRepository = {};
  const userRepository = {};
  const resourceService = {};

  let service: BookingService;

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    service = new BookingService(
      bookingRepository as any,
      resourceRepository as any,
      userRepository as any,
      resourceService as any,
    );
  });

  it('applies startDate and endDate filters to query builder', async () => {
    await service.findAll('org-1', 1, 20, 'startTime', 'ASC', '2026-02-27', '2026-05-27');

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('booking.startTime >= :startDate', {
      startDate: new Date('2026-02-27T00:00:00.000Z'),
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('booking.startTime <= :endDate', {
      endDate: new Date('2026-05-27T23:59:59.999Z'),
    });
  });

  it('rejects invalid startDate', async () => {
    await expect(service.findAll('org-1', 1, 20, 'startTime', 'ASC', 'invalid-date')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects invalid endDate', async () => {
    await expect(service.findAll('org-1', 1, 20, 'startTime', 'ASC', undefined, 'invalid-date')).rejects.toThrow(
      BadRequestException,
    );
  });
});
