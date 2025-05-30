import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersGateway } from './users.gateway';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { CommonWsService } from '../common/common-ws.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    JwtModule,
    CommonModule,
  ],
  providers: [UsersService, UsersGateway, CommonWsService],
  exports: [UsersService, UsersGateway],
})
export class UsersModule {}
