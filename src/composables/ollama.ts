import { ref, computed } from 'vue';
import { Ollama } from 'ollama/browser';
import { useConfigurationStore } from '@/stores/configuration';

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[] | null;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface PullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export function useOllama() {
  const config = useConfigurationStore();
  const models = ref<OllamaModel[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const pullProgress = ref<PullProgress | null>(null);

  const ollamaClient = computed(() => {
    const host = config['providers.ollama.host'] || 'http://127.0.0.1:11434';
    return new Ollama({ host });
  });

  const isConnected = ref(false);

  async function checkConnection() {
    try {
      isLoading.value = true;
      error.value = null;
      await ollamaClient.value.list();
      isConnected.value = true;
      return true;
    } catch (err) {
      isConnected.value = false;
      error.value = `Failed to connect to Ollama at ${config['providers.ollama.host']}. Make sure Ollama is running.`;
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchModels() {
    if (!isConnected.value) {
      const connected = await checkConnection();
      if (!connected) return;
    }

    try {
      isLoading.value = true;
      error.value = null;
      const response = await ollamaClient.value.list();
      models.value = response.models || [];
    } catch (err) {
      error.value = 'Failed to fetch models from Ollama';
      console.error('Error fetching models:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function pullModel(modelName: string) {
    try {
      isLoading.value = true;
      error.value = null;
      pullProgress.value = { status: 'Starting download...' };

      const stream = ollamaClient.value.pull({
        model: modelName,
        stream: true,
      });

      // Check if the stream is iterable
      if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
        for await (const part of stream) {
          pullProgress.value = {
            status: part.status || 'Downloading...',
            digest: part.digest,
            total: part.total,
            completed: part.completed,
          };
        }
      } else {
        // Fallback to non-streaming pull
        await ollamaClient.value.pull({
          model: modelName,
          stream: false,
        });
        pullProgress.value = { status: 'Download completed' };
      }

      // Refresh models after successful pull
      await fetchModels();
      pullProgress.value = null;
    } catch (err) {
      error.value = `Failed to pull model ${modelName}`;
      pullProgress.value = null;
      console.error('Error pulling model:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteModel(modelName: string) {
    try {
      isLoading.value = true;
      error.value = null;
      await ollamaClient.value.delete({ model: modelName });
      await fetchModels();
    } catch (err) {
      error.value = `Failed to delete model ${modelName}`;
      console.error('Error deleting model:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function chat(messages: any[], modelName: string, options: any = {}) {
    try {
      const response = await ollamaClient.value.chat({
        model: modelName,
        messages,
        ...options,
      });
      return response;
    } catch (err) {
      error.value = `Failed to chat with model ${modelName}`;
      console.error('Error in chat:', err);
      throw err;
    }
  }

  async function streamChat(messages: any[], modelName: string, options: any = {}) {
    try {
      const stream = ollamaClient.value.chat({
        model: modelName,
        messages,
        stream: true,
        ...options,
      });
      
      // Check if the stream is iterable
      if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
        return stream;
      } else {
        // Fallback to non-streaming if streaming is not supported
        const response = await ollamaClient.value.chat({
          model: modelName,
          messages,
          stream: false,
          ...options,
        });
        
        // Create a simple async generator that yields the response
        return (async function* () {
          yield response;
        })();
      }
    } catch (err) {
      error.value = `Failed to stream chat with model ${modelName}`;
      console.error('Error in stream chat:', err);
      throw err;
    }
  }

  return {
    models,
    isLoading,
    error,
    pullProgress,
    isConnected,
    checkConnection,
    fetchModels,
    pullModel,
    deleteModel,
    chat,
    streamChat,
  };
} 