import { BadRequestException, Controller, Post, Body, Logger, Get, Put, Delete, Param, Req, UseGuards, ForbiddenException, UnauthorizedException, GoneException } from '@nestjs/common';
import { UpdateUserDto, UpdateUserSchema } from '../dto/update-user.dto';
import { UserService } from '../services/user.service';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { User } from '../../../shared/auth/decorators/user.decorator';
import { User as UserEntity, UserRole } from '../entities/user.entity';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import {
  ChangeOnboardingPasswordDto,
  ChangeOnboardingPasswordSchema,
  SetOnboardingEmailDto,
  SetOnboardingEmailSchema,
  VerifyOnboardingEmailDto,
  VerifyOnboardingEmailSchema,
} from '../dto/onboarding.dto';

@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register() {
    throw new GoneException('This endpoint is deprecated. Use POST /users/register in grillrentbff_v2.');
  }

  @Post('login')
  async login() {
    throw new GoneException('This endpoint is deprecated. Use POST /users/login in grillrentbff_v2.');
  }

  @Post('logout')
  async logout() {
    throw new GoneException('This endpoint is deprecated. Use POST /users/logout in grillrentbff_v2.');
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@User() user: UserEntity) {
    this.logger.log(`Fetching profile for user ID: ${user.id}`);
    return this.userService.getProfile(user.id, user.organizationId as string);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(@Req() req: any, @Body(new JoiValidationPipe(UpdateUserSchema)) updateData: UpdateUserDto) {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User ID is missing');
    }
    if (updateData.password !== undefined) {
      throw new BadRequestException('Use onboarding password endpoint to change password');
    }

    return this.userService.updateProfile(userId, updateData, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllUsers(@User() user: UserEntity) {
    this.logger.log('Fetching all users');
    return this.userService.getAllUsers(user.organizationId as string);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateUser(
    @User() currentUser: UserEntity,
    @Param('id') id: string,
    @Body(new JoiValidationPipe(UpdateUserSchema)) updateData: UpdateUserDto,
  ) {
    this.logger.log(`Attempting to update user ID: ${id} by user ID: ${currentUser.id} with role: ${currentUser.role}`);
    if (currentUser.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${currentUser.id} does not have permission to update users`);
      throw new ForbiddenException('You do not have permission to update users');
    }
    return this.userService.updateUserById(id, updateData, currentUser);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@User() currentUser: UserEntity, @Param('id') id: string) {
    this.logger.log(`Attempting to remove user ID: ${id} by user ID: ${currentUser.id} with role: ${currentUser.role}`);
    if (currentUser.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${currentUser.id} does not have permission to delete users`);
      throw new ForbiddenException('You do not have permission to delete users');
    }
    this.logger.log(`Removing user ID: ${id}`);
    return this.userService.remove(id, currentUser.organizationId as string);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding/email')
  async setOnboardingEmail(
    @User() currentUser: UserEntity,
    @Body(new JoiValidationPipe(SetOnboardingEmailSchema)) body: SetOnboardingEmailDto,
  ) {
    return this.userService.setOnboardingEmail(currentUser.id, currentUser.organizationId as string, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding/verify')
  async verifyOnboardingEmail(
    @User() currentUser: UserEntity,
    @Body(new JoiValidationPipe(VerifyOnboardingEmailSchema)) body: VerifyOnboardingEmailDto,
  ) {
    return this.userService.verifyOnboardingEmail(currentUser.id, currentUser.organizationId as string, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding/change-password')
  async changeOnboardingPassword(
    @User() currentUser: UserEntity,
    @Body(new JoiValidationPipe(ChangeOnboardingPasswordSchema)) body: ChangeOnboardingPasswordDto,
  ) {
    return this.userService.changeOnboardingPassword(currentUser.id, currentUser.organizationId as string, body);
  }
}
