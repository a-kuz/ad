import fs from 'fs';
import path from 'path';
import { mkdirp } from 'mkdirp';
import OpenAI from 'openai';

/**
 * Logger utility for recording OpenAI API requests and responses
 */
export class LlmLogger {
  private filePairId: string;
  private outputDir: string;
  private logs: Array<{
    timestamp: Date;
    modelName: string;
    prompt: string;
    response: string;
    tokens?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    durationMs?: number;
  }> = [];

  constructor(filePairId: string) {
    this.filePairId = filePairId;
    this.outputDir = path.join(process.cwd(), 'public', 'logs', 'llm', filePairId);
    // Create the output directory immediately
    mkdirp.sync(this.outputDir);
  }

  /**
   * Log an OpenAI chat completion request and response
   */
  async logChatCompletion(
    prompt: string | Array<OpenAI.ChatCompletionMessageParam>,
    response: OpenAI.ChatCompletion,
    modelName: string,
    startTime: Date
  ): Promise<void> {
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    // Format the prompt if it's an array of messages
    const formattedPrompt = Array.isArray(prompt) 
      ? prompt.map(msg => `**${msg.role}**: ${msg.content}`).join('\n\n')
      : prompt;

    // Extract the response content
    const responseContent = response.choices[0]?.message?.content || 'No response content';

    // Add to logs array
    const logEntry = {
      timestamp: startTime,
      modelName,
      prompt: formattedPrompt,
      response: responseContent,
      tokens: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
      durationMs
    };
    this.logs.push(logEntry);

    // Save this interaction immediately
    const timestamp = startTime.toISOString().replace(/[:.]/g, '-');
    const filename = `interaction-${timestamp}.md`;
    const filePath = path.join(this.outputDir, filename);

    let markdown = `# LLM Interaction Log\n\n`;
    markdown += `Generated on: ${startTime.toISOString()}\n\n`;
    markdown += `**Model**: ${modelName}\n`;
    markdown += `**Duration**: ${durationMs}ms\n`;
    
    if (logEntry.tokens) {
      markdown += `**Tokens**: ${logEntry.tokens.totalTokens || 'N/A'} `;
      markdown += `(Prompt: ${logEntry.tokens.promptTokens || 'N/A'}, `;
      markdown += `Completion: ${logEntry.tokens.completionTokens || 'N/A'})\n`;
    }
    
    markdown += '\n### Prompt\n\n```\n';
    markdown += formattedPrompt;
    markdown += '\n```\n\n';
    
    markdown += '### Response\n\n```\n';
    markdown += responseContent;
    markdown += '\n```\n\n';

    await mkdirp(this.outputDir);
    fs.writeFileSync(filePath, markdown);
  }

  /**
   * Save all logged prompts and responses to a markdown file
   */
  async saveToFile(): Promise<string> {
    // Create directory if it doesn't exist
    await mkdirp(this.outputDir);

    // Generate timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analysis-${timestamp}.md`;
    const filePath = path.join(this.outputDir, filename);

    // Create markdown content
    let markdown = `# LLM Analysis Log for ${this.filePairId}\n\n`;
    markdown += `Generated on: ${new Date().toISOString()}\n\n`;
    markdown += `Total prompts: ${this.logs.length}\n\n`;

    // Add each prompt and response
    this.logs.forEach((log, index) => {
      markdown += `## Request ${index + 1}\n\n`;
      markdown += `**Timestamp**: ${log.timestamp.toISOString()}\n`;
      markdown += `**Model**: ${log.modelName}\n`;
      markdown += `**Duration**: ${log.durationMs}ms\n`;
      
      if (log.tokens) {
        markdown += `**Tokens**: ${log.tokens.totalTokens || 'N/A'} `;
        markdown += `(Prompt: ${log.tokens.promptTokens || 'N/A'}, `;
        markdown += `Completion: ${log.tokens.completionTokens || 'N/A'})\n`;
      }
      
      markdown += '\n### Prompt\n\n```\n';
      markdown += log.prompt;
      markdown += '\n```\n\n';
      
      markdown += '### Response\n\n```\n';
      markdown += log.response;
      markdown += '\n```\n\n';
      
      markdown += '---\n\n';
    });

    // Write to file
    fs.writeFileSync(filePath, markdown);

    return filePath;
  }

  /**
   * Get the number of logged interactions
   */
  getLogCount(): number {
    return this.logs.length;
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}

/**
 * Create an enhanced OpenAI client that logs all requests and responses
 */
export function createLoggingOpenAI(filePairId: string): { 
  openai: OpenAI;
  logger: LlmLogger;
} {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const logger = new LlmLogger(filePairId);
  
  // Wrap the chat.completions.create method to add logging
  const originalCreate = openai.chat.completions.create;
  openai.chat.completions.create = async function(...args) {
    const startTime = new Date();
    const response = await originalCreate.apply(this, args);
    
    // Log the request and response
    await logger.logChatCompletion(
      args[0].messages,
      response,
      args[0].model,
      startTime
    );
    
    return response;
  };

  return { openai, logger };
} 