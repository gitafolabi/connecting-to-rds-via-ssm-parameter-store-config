import { DynamicModule, Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { getConfig } from './config.provider';

@Global()
@Module({})
export class ConfigModule {
  static register(): DynamicModule {
    return {
      module: ConfigModule,
      imports: [
        NestConfigModule.forRoot({
          envFilePath: '.env',
          load: [getConfig],
        }),
      ],
      providers: [AppConfigService],
      exports: [AppConfigService, NestConfigModule],
    };
  }
}
