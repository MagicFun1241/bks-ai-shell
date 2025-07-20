import { defineStore } from "pinia";
import { AvailableModels, AvailableProviders, providerConfigs } from "@/config";
import { useConfigurationStore } from "./configuration";
import { useInternalDataStore } from "./internalData";
import { useTabState } from "./tabState";
import { notify } from "@beekeeperstudio/plugin";

export type Model<T extends AvailableProviders = AvailableProviders> =
  AvailableModels<T> & { provider: T };

type ChatState = {
  /** The active provider. E.g. Anthropic, OpenAI */
  provider?: string;

  /** The active model. E.g. Claude 4 Sonnet, Claude 3.5, etc. */
  model?: Model;

  /** All available models. */
  models: Model[];

  /** The title of the conversation. */
  conversationTitle: string;

  /** The model is generating a title for the conversation. */
  isGeneratingConversationTitle: boolean;
};

// Interface for Ollama model response
interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[] | null;
    parameter_size: string;
    quantization_level: string;
  }
}

interface OllamaModelsResponse {
  models: OllamaModel[];
}

// the first argument is a unique id of the store across your application
export const useChatStore = defineStore("chat", {
  state: (): ChatState => ({
    models: [],
    conversationTitle: "",
    isGeneratingConversationTitle: false,
  }),
  actions: {
    async initialize() {
      const internal = useInternalDataStore();
      const config = useConfigurationStore();
      const tabState = useTabState();
      await config.sync();
      await internal.sync();
      await tabState.sync();
      await this.syncModels();
    },
    async syncModels() {
      const config = useConfigurationStore();
      const internal = useInternalDataStore();
      const models: ChatState["models"] = [];
      
      if (config["providers.openai.apiKey"]) {
        models.push(
          ...providerConfigs.openai.models.map((m) => ({
            ...m,
            provider: "openai" as const,
          })),
        );
      }
      
      if (config["providers.anthropic.apiKey"]) {
        models.push(
          ...providerConfigs.anthropic.models.map((m) => ({
            ...m,
            provider: "anthropic" as const,
          })),
        );
      }
      
      if (config["providers.google.apiKey"]) {
        models.push(
          ...providerConfigs.google.models.map((m) => ({
            ...m,
            provider: "google" as const,
          })),
        );
      }
      
      if (config["providers.ollama.serverUrl"]) {
        try {
          // Fetch available models from Ollama API
          const response = await fetch(`${config["providers.ollama.serverUrl"]}/api/tags`);
          
          if (response.ok) {
            const data = await response.json() as OllamaModelsResponse;
            
            if (data.models && data.models.length > 0) {
              // Map Ollama models to our model format
              const ollamaModels = data.models.map(model => ({
                id: model.name,
                displayName: `${model.name} (${model.details.parameter_size})`,
                provider: "ollama" as const
              }));
              
              models.push(...ollamaModels);
            }
          } else {
            notify("pluginError", {
              message: `Failed to fetch Ollama models: ${response.statusText}`,
              name: "Ollama Error",
            });
          }
        } catch (error: any) {
          notify("pluginError", {
            message: `Error fetching Ollama models: ${error.message}`,
            name: "Ollama Error",
          });
        }
      }
      
      this.models = models;
      this.model =
        this.models.find((m) => m.id === internal.lastUsedModelId) || models[0];
    },
  },
});
