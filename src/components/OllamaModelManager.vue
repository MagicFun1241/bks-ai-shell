<template>
  <div class="ollama-manager">
    <div class="ollama-header">
      <h3>Ollama Model Manager</h3>
      <button 
        class="btn btn-secondary" 
        @click="checkConnection"
        :disabled="isLoading"
      >
        {{ isConnected ? 'Connected' : 'Check Connection' }}
      </button>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div class="ollama-actions">
      <div class="pull-model-section">
        <h4>Pull New Model</h4>
        <div class="pull-form">
          <input
            v-model="modelToPull"
            type="text"
            placeholder="Model name (e.g., llama3.1:8b)"
            class="model-input"
          />
          <button 
            class="btn btn-primary" 
            @click="pullModel"
            :disabled="!modelToPull || isLoading"
          >
            Pull Model
          </button>
        </div>
        
        <div v-if="pullProgress" class="pull-progress">
          <div class="progress-status">{{ pullProgress.status }}</div>
          <div v-if="pullProgress.total && pullProgress.completed" class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: `${(pullProgress.completed / pullProgress.total) * 100}%` }"
            ></div>
          </div>
          <div v-if="pullProgress.digest" class="progress-details">
            Digest: {{ pullProgress.digest }}
          </div>
        </div>
      </div>

      <div class="models-section">
        <h4>Available Models</h4>
        <button 
          class="btn btn-secondary" 
          @click="fetchModels"
          :disabled="isLoading"
        >
          Refresh Models
        </button>
        
        <div v-if="isLoading" class="loading">
          Loading models...
        </div>
        
        <div v-else-if="models.length === 0" class="no-models">
          No models found. Pull a model to get started.
        </div>
        
        <div v-else class="models-list">
          <div 
            v-for="model in models" 
            :key="model.name"
            class="model-item"
          >
            <div class="model-info">
              <div class="model-name">{{ model.name }}</div>
              <div class="model-details">
                <span class="model-size">{{ formatSize(model.size) }}</span>
                <span class="model-modified">{{ formatDate(model.modified_at) }}</span>
              </div>
              <div v-if="model.details" class="model-params">
                <span class="param-size">{{ model.details.parameter_size }}</span>
                <span v-if="model.details.quantization_level" class="quantization">
                  {{ model.details.quantization_level }}
                </span>
              </div>
            </div>
            <button 
              class="btn btn-danger" 
              @click="deleteModel(model.name)"
              :disabled="isLoading"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { ref, onMounted } from 'vue';
import { useOllama } from '@/composables/ollama';

export default {
  name: 'OllamaModelManager',
  
  setup() {
    const {
      models,
      isLoading,
      error,
      pullProgress,
      isConnected,
      checkConnection,
      fetchModels,
      pullModel: pullModelFn,
      deleteModel: deleteModelFn,
    } = useOllama();

    const modelToPull = ref('');

    const pullModel = async () => {
      if (modelToPull.value) {
        await pullModelFn(modelToPull.value);
        modelToPull.value = '';
      }
    };

    const deleteModel = async (modelName: string) => {
      if (confirm(`Are you sure you want to delete ${modelName}?`)) {
        await deleteModelFn(modelName);
      }
    };

    const formatSize = (bytes: number) => {
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      if (bytes === 0) return '0 B';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString();
    };

    onMounted(async () => {
      await checkConnection();
      if (isConnected.value) {
        await fetchModels();
      }
    });

    return {
      models,
      isLoading,
      error,
      pullProgress,
      isConnected,
      modelToPull,
      checkConnection,
      fetchModels,
      pullModel,
      deleteModel,
      formatSize,
      formatDate,
    };
  },
};
</script>

<style scoped>
.ollama-manager {
  padding: 1rem;
  background: var(--background-secondary);
  border-radius: 8px;
  margin: 1rem 0;
}

.ollama-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.ollama-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.error-message {
  background: var(--error-background);
  color: var(--error-text);
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.ollama-actions {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.pull-model-section,
.models-section {
  background: var(--background-primary);
  padding: 1rem;
  border-radius: 6px;
}

.pull-model-section h4,
.models-section h4 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
}

.pull-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.model-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--background-primary);
  color: var(--text-primary);
}

.pull-progress {
  background: var(--background-secondary);
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.progress-status {
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--background-primary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s ease;
}

.progress-details {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.loading,
.no-models {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.models-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--background-secondary);
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.model-info {
  flex: 1;
}

.model-name {
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.model-details {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.model-params {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.param-size,
.quantization {
  background: var(--background-primary);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  color: var(--text-secondary);
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-secondary {
  background: var(--background-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--background-hover);
}

.btn-danger {
  background: var(--error-color);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: var(--error-hover);
}
</style> 