import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersGateway } from './users.gateway';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { CommonModule } from '../common/common.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    forwardRef(() => AuthModule),
    JwtModule,
    CommonModule,
    SearchModule,
  ],
  providers: [UsersService, UsersGateway],
  exports: [UsersService, UsersGateway],
})
export class UsersModule {}
