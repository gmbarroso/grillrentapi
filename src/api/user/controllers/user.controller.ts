import { Controller, Post, Body, Logger, Get, Put, Delete, Param, Req, UseGuards, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto, CreateUserSchema } from '../dto/create-user.dto';
import { LoginUserDto, LoginUserSchema } from '../dto/login-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserService } from '../services/user.service';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { User } from '../../../shared/auth/decorators/user.decorator';
import { User as UserEntity, UserRole } from '../entities/user.entity';
import { AuthService } from '../../../shared/auth/services/auth.service';

@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService
  ) {}

  @Post('register')
  async register(@Body(new JoiValidationPipe(CreateUserSchema)) createUserDto: CreateUserDto) {
    this.logger.log(`Registering user: ${createUserDto.name}`);
    const user = await this.userService.register(createUserDto);
    return { message: 'User registered successfully', user };
  }

  @Post('login')
  async login(@Body(new JoiValidationPipe(LoginUserSchema)) loginUserDto: LoginUserDto) {
    this.logger.log(`Logging in user from apartment: ${loginUserDto.apartment}, block: ${loginUserDto.block}`);
    return this.authService.login(loginUserDto);
  }

  @Post('logout')
  async logout(@Req() req) {
    const token = req.headers.authorization.split(' ')[1];
    const isRevoked = await this.authService.isTokenRevoked(token);
    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked');
    }
    this.logger.log('Logging out user');
    return this.authService.logout(token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@User() user: UserEntity) {
    this.logger.log(`Fetching profile for user ID: ${user.id}`);
    return this.userService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(@User() user: UserEntity, @Body() updateUserDto: UpdateUserDto) {
    this.logger.log(`Updating profile for user ID: ${user.id}`);
    return this.userService.updateProfile(user.id, updateUserDto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllUsers() {
    this.logger.log('Fetching all users');
    return this.userService.getAllUsers();
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
    return this.userService.remove(id);
  }
}
