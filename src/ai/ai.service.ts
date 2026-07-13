import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatOpenAI } from '@langchain/openai';
import {
  createToolCallingAgent,
  AgentExecutor,
} from '@langchain/classic/agents';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { loadMcpTools } from '@langchain/mcp-adapters';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
  ) {}

  public async getChatResponse(
    userId: string,
    token: string,
    message: string,
    onWord: (word: string) => void,
    checkCancelled: () => boolean,
  ) {
    // 1. Validate environment early
    if (!process.env.NVIDIA_API_KEY) {
      throw new Error('NVIDIA_API_KEY environment variable is required');
    }

    // 2. Load the last 6 messages for chat history
    const history = await this.chatMessageRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'ASC' },
      take: 6,
    });

    const chatHistory = history.map((msg) =>
      msg.role === 'user'
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content),
    );

    // Save the new human message to the DB
    const newHumanMsg = this.chatMessageRepository.create({
      role: 'user',
      content: message,
      user: { id: userId },
    });
    await this.chatMessageRepository.save(newHumanMsg);
    chatHistory.push(new HumanMessage(message));

    // 3. Connect to MCP Server via StreamableHTTPClientTransport and inject the token via Headers
    const mcpUrl = new URL(
      process.env.MCP_SERVER_URL || 'http://localhost:8080/mcp',
    );
    const transport = new StreamableHTTPClientTransport(mcpUrl, {
      requestInit: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const client = new Client(
      { name: 'nestjs-client', version: '1.0.0' },
      { capabilities: {} },
    );

    try {
      await client.connect(transport);
    } catch (error) {
      this.logger.error('Failed to connect to MCP server', error);
      throw new Error('Service unavailable: MCP server unreachable');
    }

    try {
      // Convert standard MCP tools into LangChain tools dynamically
      const tools = await loadMcpTools('xpense-mcp', client);

      // 4. Define the Agent
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          "You are a highly capable personal finance assistant for the Xpense app. You can use your tools to securely query the user's real-time financial data. Be concise, friendly, and helpful. Always format financial numbers nicely. IMPORTANT: At the very end of every response you give, you MUST provide exactly one related follow-up question the user could ask you next, formatted exactly like this: <suggestion>Question text here</suggestion>",
        ],
        new MessagesPlaceholder('chat_history'),
        ['human', '{input}'],
        new MessagesPlaceholder('agent_scratchpad'),
      ]);

      const model = new ChatOpenAI({
        model: process.env.NVIDIA_MODEL_NAME || 'deepseek-ai/deepseek-r1',
        apiKey: process.env.NVIDIA_API_KEY,
        configuration: {
          baseURL: 'https://integrate.api.nvidia.com/v1',
        },
      });

      const agent = await createToolCallingAgent({ llm: model, tools, prompt });
      const executor = new AgentExecutor({ agent, tools });

      // 5. Stream response
      const eventStream = await executor.streamEvents(
        {
          input: message,
          chat_history: chatHistory,
        },
        { version: 'v2' },
      );

      let streamedResponse = '';

      for await (const event of eventStream) {
        if (checkCancelled()) break;

        if (event.event === 'on_tool_start') {
          this.logger.log(`[Tool Used]: ${event.name}`);
        }

        if (
          event.event === 'on_chat_model_stream' &&
          event.data.chunk?.content
        ) {
          const word = event.data.chunk.content;
          streamedResponse += word;
          onWord(word); // Send token to client
        }
      }

      // 6. Save the assistant's response to the DB
      const newAiMsg = this.chatMessageRepository.create({
        role: 'assistant',
        content: streamedResponse,
        user: { id: userId },
      });
      await this.chatMessageRepository.save(newAiMsg);
    } finally {
      // Close the HTTP connection gracefully when done
      await client.close();
    }
  }
}
