import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  UseGuards,
  Request,
  Res,
  Delete,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ChatMessageDto } from './dto/chat-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('chat')
  async getChatHistory(
    @Request() req,
    @Res() res: Response,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;
    const history = await this.aiService.getUserChatHistory(
      req.user.id,
      parsedLimit,
      parsedSkip,
    );
    res.status(200).send(history);
  }

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

  @Delete('chat')
  async clearChat(@Request() req, @Res() res: Response) {
    await this.aiService.clearUserChat(req.user.id);
    res.status(200).send({ message: 'Chat history cleared' });
  }
}
