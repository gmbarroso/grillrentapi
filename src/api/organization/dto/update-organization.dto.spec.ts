import { UpdateOrganizationSchema } from './update-organization.dto';

describe('UpdateOrganizationSchema', () => {
  it.each([true, false])('accepts sidebar visibility %s without requiring a name update', (visible) => {
    const result = UpdateOrganizationSchema.validate({ showNameInSidebar: visible });
    expect(result.error).toBeUndefined();
    expect(result.value.showNameInSidebar).toBe(visible);
    expect(result.value).not.toHaveProperty('name');
  });

  it.each(['', '   ', 'A', null])('rejects invalid name %p even when hidden', (name) => {
    expect(UpdateOrganizationSchema.validate({ name, showNameInSidebar: false }).error).toBeDefined();
  });

  it.each(['false', 0, null])('rejects non-boolean visibility %p', (showNameInSidebar) => {
    expect(UpdateOrganizationSchema.validate({ showNameInSidebar }).error).toBeDefined();
  });

  it('leaves visibility absent when updating other settings', () => {
    const result = UpdateOrganizationSchema.validate({ name: ' Condomínio Norte ' });
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual({ name: 'Condomínio Norte' });
  });
});
