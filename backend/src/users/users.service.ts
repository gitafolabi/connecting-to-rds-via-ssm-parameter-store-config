import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UsersEntity } from './users.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(UsersEntity)
    private readonly usersRepository: typeof UsersEntity,
  ) {}

  public async findAll(): Promise<UsersEntity[]> {
    return this.usersRepository.findAll();
  }
}
