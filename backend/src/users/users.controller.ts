import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(): Promise<any> {
    try {
      const users = await this.usersService.findAll();
      return users;
    } catch (error) {
      return JSON.stringify(error, null, 4);
    }
  }
}
