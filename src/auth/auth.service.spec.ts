import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  const mockUsersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create a user and return a success message', async () => {
      const dto = { name: 'Test', email: 'test@test.com', password: 'pass' };
      const user = { id: '1', ...dto };
      mockUsersService.create.mockResolvedValueOnce(user);

      const result = await service.register(dto);
      expect(result).toEqual({ message: 'Registration successful', user });
      expect(mockUsersService.create).toHaveBeenCalledWith(dto.name, dto.email, dto.password);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce(null);
      await expect(service.login({ email: 'test@test.com', password: 'p' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password incorrect', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce({ id: '1', password: 'hash' });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      await expect(service.login({ email: 'test@test.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should return token and user if login successful', async () => {
      const user = { id: '1', name: 'Test', email: 'test@test.com', password: 'hash' };
      mockUsersService.findByEmail.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockJwtService.sign.mockReturnValueOnce('token');

      const result = await service.login({ email: 'test@test.com', password: 'pass' });
      expect(result).toEqual({
        access_token: 'token',
        user: { id: '1', name: 'Test', email: 'test@test.com' },
      });
    });
  });
});
