import instructions from "../instructions.txt?raw";
import mongodbInstructions from "../mongodb-instructions.txt?raw";
import { getConnectionInfo, getTables } from "@beekeeperstudio/plugin";

export async function getDefaultInstructions() {
  let response;
  try {
    response = await getConnectionInfo();
  } catch (error) {
    console.warn('Failed to get connection info:', error);
    response = {
      connectionType: 'unknown',
      readOnlyMode: false,
      databaseName: 'unknown',
      defaultSchema: '',
    };
  }
  
  let tables: Array<{ name: string; schema?: string }> = [];
  try {
    const tablesResult = await getTables();
    if (tablesResult && Array.isArray(tablesResult)) {
      tables = tablesResult.filter(
        (table) =>
          table.schema !== "information_schema" &&
          table.schema !== "pg_catalog" &&
          table.schema !== "pg_toast" &&
          table.schema !== "sys" &&
          table.schema !== "INFORMATION_SCHEMA",
      );
    }
  } catch (error) {
    console.warn('Failed to get tables:', error);
    tables = [];
  }
  
  let result = instructions;
  result = result.replace("{current_date}", getCurrentDateFormatted());
  result = result.replace("{connection_type}", response?.connectionType || 'unknown');
  result = result.replace("{read_only_mode}", (response?.readOnlyMode || false).toString());
  result = result.replace("{database_name}", response?.databaseName || 'unknown');
  result = result.replace("{default_schema}", response?.defaultSchema || "");
  result = result.replace("{tables}", JSON.stringify(tables));

  if (response?.connectionType === "mongodb") {
    result = mongodbInstructions.replace("{instructions.txt}", result);
  }

  return result;
}

function getCurrentDateFormatted() {
  const now = new Date();
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  return now.toLocaleDateString(undefined, options);
}

export const defaultTemperature = 0.7;

// Storage keys
export const STORAGE_KEYS = {
  API_KEY: "chatbot_api_key",
  PROVIDER: "chatbot_provider",
  MODEL: "chatbot_model",
  HAS_OPENED_TABLE_RESULT: "chatbot_has_opened_table_result",
};

export type AvailableProviders = keyof typeof providerConfigs;

export type AvailableModels<T extends AvailableProviders | unknown = unknown> =
  T extends AvailableProviders
  ? (typeof providerConfigs)[T]["models"][number]
  : (typeof providerConfigs)[AvailableProviders]["models"][number];

export const providerConfigs = {
  anthropic: {
    displayName: "Anthropic",
    /** https://docs.anthropic.com/en/docs/about-claude/models/overview */
    models: [
      { id: "claude-opus-4-0", displayName: "Claude Opus 4" },
      { id: "claude-sonnet-4-0", displayName: "Claude Sonnet 4" },
      { id: "claude-3-7-sonnet-latest", displayName: "Claude Sonnet 3.7" },
      { id: "claude-3-5-haiku-latest", displayName: "Claude Haiku 3.5" },
      {
        id: "claude-3-5-sonnet-latest",
        displayName: "Claude Sonnet 3.5 Latest",
      },
      { id: "claude-3-haiku", displayName: "Claude Haiku 3" },
    ],
  },
  google: {
    displayName: "Google",
    /** https://ai.google.dev/gemini-api/docs/models */
    models: [
      { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
      {
        id: "gemini-2.5-flash-lite-preview-06-17",
        displayName: "Gemini 2.5 Flash-Lite Preview",
      },
      { id: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash" },
      { id: "gemini-2.0-flash-lite", displayName: "Gemini 2.0 Flash-Lite" },
      { id: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash" },
      { id: "gemini-1.5-flash-8b", displayName: "Gemini 1.5 Flash-8B" },
      { id: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro" },
    ],
  },
  openai: {
    displayName: "OpenAI",
    models: [
      { id: "gpt-4.1", displayName: "gpt-4.1" },
      { id: "gpt-4.1-mini", displayName: "gpt-4.1-mini" },
      { id: "gpt-4.1-nano", displayName: "gpt-4.1-nano" },
      { id: "gpt-4o", displayName: "gpt-4o" },
      { id: "gpt-4o", displayName: "gpt-4o-mini" },
      { id: "o3", displayName: "o3" },
      { id: "o3-mini", displayName: "o3-mini" },
      { id: "o4-mini", displayName: "o4-mini" },
    ],
  },
  ollama: {
    displayName: "Ollama (Local)",
    models: [
      { id: "llama3.1", displayName: "Llama 3.1" },
      { id: "llama3.1:8b", displayName: "Llama 3.1 8B" },
      { id: "llama3.1:70b", displayName: "Llama 3.1 70B" },
      { id: "llama3.2", displayName: "Llama 3.2" },
      { id: "llama3.2:8b", displayName: "Llama 3.2 8B" },
      { id: "llama3.2:70b", displayName: "Llama 3.2 70B" },
      { id: "mistral", displayName: "Mistral" },
      { id: "mistral:7b", displayName: "Mistral 7B" },
      { id: "codellama", displayName: "Code Llama" },
      { id: "codellama:7b", displayName: "Code Llama 7B" },
      { id: "codellama:13b", displayName: "Code Llama 13B" },
      { id: "codellama:34b", displayName: "Code Llama 34B" },
      { id: "phi3", displayName: "Phi-3" },
      { id: "phi3:mini", displayName: "Phi-3 Mini" },
      { id: "phi3:medium", displayName: "Phi-3 Medium" },
      { id: "qwen2", displayName: "Qwen2" },
      { id: "qwen2:7b", displayName: "Qwen2 7B" },
      { id: "qwen2:72b", displayName: "Qwen2 72B" },
    ],
  },
} as const;
