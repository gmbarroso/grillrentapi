import { Controller, Post, Get, Put, Body, Req, UseGuards, Logger } from '@nestjs/common';
import { CreateUserDto, CreateUserSchema } from '../dto/create-user.dto';
import { LoginUserDto, LoginUserSchema } from '../dto/login-user.dto';
import { UpdateUserDto, UpdateUserSchema } from '../dto/update-user.dto';
import { UserService } from '../services/user.service';
import { AuthGuard } from '@nestjs/passport';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';

@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(@Body(new JoiValidationPipe(CreateUserSchema)) createUserDto: CreateUserDto) {
    this.logger.log(`Call register user endpoint: ${createUserDto.username}`);
    return this.userService.register(createUserDto);
  }

  @Post('login')
  async login(@Body(new JoiValidationPipe(LoginUserSchema)) loginUserDto: LoginUserDto) {
    this.logger.log(`Login endpoint called for user: ${loginUserDto.username}`);
    return this.userService.login(loginUserDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Req() req) {
    this.logger.log(`Get profile endpoint called for user ID: ${req.user.id}`);
    return this.userService.getProfile(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('profile')
  async updateProfile(@Req() req, @Body(new JoiValidationPipe(UpdateUserSchema)) updateUserDto: UpdateUserDto) {
    this.logger.log(`Update profile endpoint called for user ID: ${req.user.id}`);
    return this.userService.updateProfile(req.user.id, updateUserDto);
  }
}
