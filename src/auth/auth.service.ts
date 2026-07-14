import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.create(
      registerDto.name,
      registerDto.email,
      registerDto.password,
    );
    return {
      message: 'Registration successful',
      user,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(
      loginDto.password,
      user.password || '',
    );
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { sub: user.id, email: user.email, name: user.name };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async googleLogin(accessToken: string) {
    let payload;
    try {
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }
      payload = await response.json();
    } catch (e) {
      throw new UnauthorizedException('Invalid Google access token');
    }

    if (!payload || !payload.email) {
      throw new UnauthorizedException('Invalid Google token payload');
    }

    let user = await this.usersService.findByEmail(payload.email);
    if (!user) {
      // Create a random password for OAuth users since they don't need one to login via Google again
      const randomPassword = Math.random().toString(36).slice(-10) + 'A1@';
      user = await this.usersService.create(
        payload.name || payload.email.split('@')[0],
        payload.email,
        randomPassword,
      );
    }

    const jwtPayload = { sub: user.id, email: user.email, name: user.name };
    return {
      access_token: this.jwtService.sign(jwtPayload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }
}
