import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ChatMessageDto } from './dto/chat-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(
    @Request() req,
    @Body() dto: ChatMessageDto,
    @Res() res: Response,
  ) {
    const message = dto.message;
    // Extract the raw JWT token from the Authorization header to pass to the MCP server
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).send('Unauthorized: No Bearer token found');
      return;
    }
    const token = authHeader.split(' ')[1];

    // Set headers for standard HTTP chunked streaming (ReadableStream compatible on the frontend)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Connection', 'keep-alive');

    await this.aiService.getChatResponse(
      req.user.id,
      token,
      message,
      // onWord callback: stream tokens immediately to the client
      (word: string) => {
        res.write(word);
      },
      // checkCancelled: stop if the client disconnects prematurely
      () => res.destroyed,
    );

    res.end(); // Close the stream when the agent is done
  }
}
