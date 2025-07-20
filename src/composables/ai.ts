import {
  InvalidToolArgumentsError,
  NoSuchToolError,
  streamText,
  generateObject,
  ToolExecutionError,
} from "ai";
import { useChat } from "@ai-sdk/vue";
import { ref, watch } from "vue";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider";
import {
  getDefaultInstructions,
  defaultTemperature,
  AvailableProviders,
  AvailableModels,
} from "@/config";
import { getTools, UserRejectedError } from "@/tools";
import { Message } from "ai";
import { useTabState } from "@/stores/tabState";
import { notify } from "@beekeeperstudio/plugin";
import { z } from "zod";
import { useConfigurationStore } from "@/stores/configuration";

type AIOptions = {
  initialMessages: Message[];
  anthropicApiKey?: string;
  openaiApiKey?: string;
  googleApiKey?: string;
};

export function useAI(options: AIOptions) {
  const providerId = ref<AvailableProviders | undefined>();
  const modelId = ref<AvailableModels["id"] | undefined>();
  const askingPermission = ref(false);
  const followupAfterRejected = ref("");
  const isModelPulling = ref(false);
  const configStore = useConfigurationStore();

  let permitted = false;

  const { messages, input, append, error, status, addToolResult, stop } =
    useChat({
      fetch: async (url, fetchOptions) => {
        if (!modelId.value) {
          throw new Error("No provider or model selected.");
        }
        const model = createProvider().chat(modelId.value);
        const m = JSON.parse(fetchOptions.body) as any;
        const result = streamText({
          model,
          messages: m.messages,
          abortSignal: fetchOptions.signal,
          system: await getDefaultInstructions(),
          tools: getTools(async (name, params) => {
            askingPermission.value = true;
            await new Promise<void>((resolve) => {
              const unwatch = watch(askingPermission, () => {
                if (!askingPermission.value) {
                  unwatch();
                  resolve();
                }
              });
            });
            askingPermission.value = false;
            return permitted;
          }),
          maxSteps: 10,
          temperature: defaultTemperature,
        });
        return result.toDataStreamResponse({
          getErrorMessage: (error: unknown) => {
            console.log(error);
            
            // Handle HTTP errors (like 400 Bad Request)
            if (error && typeof error === 'object' && 'cause' in error && error.cause instanceof Error) {
              // Try to parse the error message if it's from the Ollama API
              try {
                const errorMessage = error.cause.message;
                
                // Check if it's a JSON string containing an error message
                if (errorMessage.includes('{') && errorMessage.includes('error')) {
                  const errorJson = JSON.parse(errorMessage.substring(errorMessage.indexOf('{')));
                  if (errorJson.error) {
                    return `Ollama API Error: ${errorJson.error}`;
                  }
                }
                
                // Check for specific error patterns
                if (errorMessage.includes('400 Bad Request')) {
                  return 'The Ollama server returned a Bad Request error. The model might not support the requested operation.';
                }
              } catch (parseError) {
                // If we can't parse the error, fall back to the original error message
              }
            }
            
            if (NoSuchToolError.isInstance(error)) {
              return "The model tried to call a unknown tool.";
            } else if (InvalidToolArgumentsError.isInstance(error)) {
              return "The model called a tool with invalid arguments.";
            } else if (ToolExecutionError.isInstance(error)) {
              if (UserRejectedError.isInstance(error.cause)) {
                return `User rejected tool call. (toolCallId: ${error.toolCallId})`;
              } else {
                return "An error occurred during tool execution.";
              }
            } else {
              return "An unknown error occurred.";
            }
          },
        });
      },
      onError: (error) => {
        notify("pluginError", {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
        if (error.message.includes("User rejected tool call.")) {
          addToolResult({
            toolCallId: error.message.split("toolCallId: ")[1].split(")")[0],
            result: JSON.stringify({
              type: "error",
              message: "No - Tell the AI what to do differently.",
            }),
          });
          saveMessages();
          if (followupAfterRejected.value) {
            append({
              role: "user",
              content: followupAfterRejected.value,
            });
            followupAfterRejected.value = "";
            fillTitle();
          }
        }
      },
      onFinish: () => {
        saveMessages();
        fillTitle();
      },
      initialMessages: options.initialMessages,
    });

  function createProvider() {
    if (!providerId.value) {
      throw new Error("No provider selected.");
    }

    if (providerId.value === "google") {
      return createGoogleGenerativeAI({
        apiKey: options.googleApiKey,
      });
    } else if (providerId.value === "anthropic") {
      return createAnthropic({
        apiKey: options.anthropicApiKey,
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' }
      });
    } else if (providerId.value === "openai") {
      return createOpenAI({
        compatibility: "strict",
        apiKey: options.openaiApiKey,
      });
    } else if (providerId.value === "ollama") {
      return createOllama({
        baseURL: configStore["providers.ollama.serverUrl"],
        fetch: async (url, init) => {
          // Fix the API endpoint structure by ensuring /api/ is in the path
          const apiUrl = new URL(url);
          if (!apiUrl.pathname.includes('/api/')) {
            const pathParts = apiUrl.pathname.split('/');
            const endpoint = pathParts[pathParts.length - 1];
            apiUrl.pathname = `/api/${endpoint}`;
            url = apiUrl.toString();
          }
          return fetch(url, init);
        }
      });
    }

    throw new Error("Unknown provider");
  }

  function saveMessages() {
    useTabState().setTabState("messages", messages.value);
  }

  async function setModel<T extends AvailableProviders>(
    provider: T,
    model: AvailableModels<T>["id"],
  ) {
    providerId.value = provider;
    
    // If Ollama is selected, check if the model exists and pull it if not
    if (provider === "ollama") {
      try {
        isModelPulling.value = true;
        
        // Check if model exists
        const response = await fetch(`${configStore["providers.ollama.serverUrl"]}/api/tags`);
        if (!response.ok) {
          throw new Error(`Failed to fetch models from Ollama server: ${response.statusText}`);
        }
        
        const data = await response.json();
        const models = data.models || [];
        const modelName = typeof model === 'string' ? model.split(':')[0] : '';
        const modelExists = models.some((m: any) => 
          m.name === model || 
          (modelName && m.name === modelName) ||
          (m.name && m.name.startsWith(modelName))
        );
        
        // Pull model if it doesn't exist
        if (!modelExists) {
          notify("pluginError", {
            message: `Pulling model: ${model}. This may take a few minutes for the first time.`,
            name: "Ollama",
            stack: null,
          });
          
          const pullResponse = await fetch(`${configStore["providers.ollama.serverUrl"]}/api/pull`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: model }),
          });
          
          if (!pullResponse.ok) {
            throw new Error(`Failed to pull model: ${model}`);
          }
          
          // Stream the pull response
          const reader = pullResponse.body?.getReader();
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              // Process the streaming response if needed
            }
          }
          
          notify("pluginError", {
            message: `Successfully pulled model: ${model}`,
            name: "Ollama",
            stack: null,
          });
        }
      } catch (error: any) {
        notify("pluginError", {
          message: `Error with Ollama model: ${error.message}`,
          name: "Ollama Error",
          stack: error.stack,
        });
      } finally {
        isModelPulling.value = false;
      }
    }
    
    modelId.value = model;
  }

  function acceptPermission() {
    permitted = true;
    askingPermission.value = false;
  }

  /** After the user rejected the permission, they can provide a follow-up message */
  function rejectPermission(userFollowup?: string) {
    if (userFollowup) {
      followupAfterRejected.value = userFollowup;
    }
    permitted = false;
    askingPermission.value = false;
  }

  async function fillTitle() {
    if (!modelId.value) {
      throw new Error("No provider or model selected.");
    }
    if (useTabState().conversationTitle) {
      // Skip generation if title is already set
      return;
    }
    const model = createProvider().languageModel(modelId.value);
    const res = await generateObject({
      model,
      schema: z.object({
        title: z.string().describe("The title of the conversation"),
      }),
      prompt:
        "Name this conversation in less than 30 characters.\n```" +
        messages.value.map((m) => `${m.role}: ${m.content}`).join("\n") +
        "\n```",
    });
    await useTabState().setTabTitle(res.object.title);
  }

  /** Send a message to the AI */
  function send(message: string) {
    append({
      role: "user",
      content: message,
    });
  }

  function abort() {
    stop();
    saveMessages();
  }

  return {
    messages,
    provider: providerId,
    input,
    error,
    status,
    setModel,
    askingPermission,
    acceptPermission,
    rejectPermission,
    send,
    abort,
    isModelPulling,
  };
}
