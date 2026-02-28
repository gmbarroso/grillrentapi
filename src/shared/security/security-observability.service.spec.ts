import { Logger } from '@nestjs/common';
import { SecurityObservabilityService } from './security-observability.service';

describe('SecurityObservabilityService', () => {
  it('sanitizes control characters in structured log fields', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new SecurityObservabilityService();

    service.recordAuthFailure('invalid\npayload', '/users/profile\r\nx');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    const parsed = JSON.parse(message as string);
    expect(parsed.event).toBe('auth_failure');
    expect(parsed.reason).toBe('invalid payload');
    expect(parsed.context).toBe('/users/profile  x');

    warnSpy.mockRestore();
  });
});
