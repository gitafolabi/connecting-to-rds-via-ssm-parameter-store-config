import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppConfigService } from '../config/app-config.service';
import { UsersEntity } from '../users/users.entity';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      inject: [AppConfigService],
      useFactory(configService: AppConfigService) {
        const databaseConfig = configService.getDatabaseConfig();
        console.log(databaseConfig);
        return {
          dialect: 'postgres',
          database: databaseConfig.name,
          host: databaseConfig.hostname,
          username: databaseConfig.username,
          password: databaseConfig.password,
          port: Number(databaseConfig.port),
          models: [UsersEntity],
        };
      },
    }),
  ],
})
export class DatabaseModule {}
