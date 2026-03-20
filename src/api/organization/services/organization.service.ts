import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { Organization } from '../entities/organization.entity';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    const normalizedName = createOrganizationDto.name.trim();
    const customSlug = createOrganizationDto.slug ? this.normalizeSlug(createOrganizationDto.slug) : undefined;
    const slug = customSlug
      ? await this.ensureUniqueCustomSlug(customSlug)
      : await this.nextAvailableSlug(this.normalizeSlug(normalizedName));

    const existingName = await this.organizationRepository.findOne({
      where: { name: normalizedName },
    });

    const organization = this.organizationRepository.create({
      name: normalizedName,
      slug,
      address: this.normalizeOptional(createOrganizationDto.address),
      email: this.normalizeOptional(createOrganizationDto.email),
      phone: this.normalizeOptional(createOrganizationDto.phone),
      businessHours: this.normalizeOptional(createOrganizationDto.businessHours),
      timezone: createOrganizationDto.timezone || 'America/Sao_Paulo',
      openingTime: this.normalizeOptional(createOrganizationDto.openingTime),
      closingTime: this.normalizeOptional(createOrganizationDto.closingTime),
      logoUrl: this.normalizeOptional(createOrganizationDto.logoUrl),
    });

    try {
      const savedOrganization = await this.organizationRepository.save(organization);
      return {
        message: 'Organization created successfully',
        organization: savedOrganization,
        nameAlreadyExists: Boolean(existingName),
      };
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException('Organization slug already exists');
      }
      throw error;
    }
  }

  async findBySlug(slug: string): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({
      where: { slug: this.normalizeSlug(slug) },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  async findById(id: string): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({ where: { id } });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  async updateById(id: string, updateOrganizationDto: UpdateOrganizationDto): Promise<Organization> {
    const organization = await this.findById(id);

    if (updateOrganizationDto.name !== undefined) {
      const normalizedName = updateOrganizationDto.name.trim();
      if (normalizedName) {
        organization.name = normalizedName;
      }
    }

    if (updateOrganizationDto.address !== undefined) {
      organization.address = this.normalizeOptional(updateOrganizationDto.address);
    }
    if (updateOrganizationDto.email !== undefined) {
      organization.email = this.normalizeOptional(updateOrganizationDto.email);
    }
    if (updateOrganizationDto.phone !== undefined) {
      organization.phone = this.normalizeOptional(updateOrganizationDto.phone);
    }
    if (updateOrganizationDto.businessHours !== undefined) {
      organization.businessHours = this.normalizeOptional(updateOrganizationDto.businessHours);
    }
    if (updateOrganizationDto.timezone !== undefined) {
      organization.timezone = updateOrganizationDto.timezone.trim() || organization.timezone;
    }
    if (updateOrganizationDto.openingTime !== undefined) {
      organization.openingTime = this.normalizeOptional(updateOrganizationDto.openingTime);
    }
    if (updateOrganizationDto.closingTime !== undefined) {
      organization.closingTime = this.normalizeOptional(updateOrganizationDto.closingTime);
    }
    if (updateOrganizationDto.logoUrl !== undefined) {
      organization.logoUrl = this.normalizeOptional(updateOrganizationDto.logoUrl);
    }

    return this.organizationRepository.save(organization);
  }

  private normalizeOptional(value?: string | null): string | undefined {
    if (!value) return undefined;
    const normalized = value.trim();
    return normalized || undefined;
  }

  private normalizeSlug(input: string): string {
    return input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/--+/g, '-');
  }

  private async nextAvailableSlug(baseSlug: string): Promise<string> {
    if (!baseSlug) {
      throw new ConflictException('Invalid organization slug');
    }

    const rootSlug = baseSlug;
    let candidate = rootSlug;
    let suffix = 2;

    while (await this.organizationRepository.findOne({ where: { slug: candidate } })) {
      candidate = `${rootSlug}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private async ensureUniqueCustomSlug(slug: string): Promise<string> {
    if (!slug) {
      throw new ConflictException('Invalid organization slug');
    }
    const existing = await this.organizationRepository.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException('Organization slug already exists');
    }
    return slug;
  }
}
