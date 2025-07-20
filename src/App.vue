<template>
  <div class="shell-app">
    <div v-if="!appReady" v-show="showLoading" class="not-ready">
      <h1>AI Shell</h1>
      <div class="progress-bar"></div>
    </div>
    <template v-else>
      <!-- API Key Form -->
      <ApiKeyForm
        v-if="!apiKeyExists || page === 'api-key-form'"
        @submit="page = 'chat-interface'"
        @cancel="page = 'chat-interface'"
        :cancelable="apiKeyExists"
      />

      <!-- Ollama Model Manager -->
      <div v-else-if="page === 'ollama-manager'" class="ollama-manager-page">
        <div class="page-header">
          <button class="btn btn-secondary" @click="page = 'chat-interface'">
            ← Back to Chat
          </button>
          <h2>Ollama Model Manager</h2>
        </div>
        <OllamaModelManager />
      </div>

      <ChatInterface
        v-else
        :initialMessages="messages"
        :openaiApiKey="openaiApiKey"
        :anthropicApiKey="anthropicApiKey"
        :googleApiKey="googleApiKey"
        :ollamaHost="ollamaHost"
        @manage-models="page = 'api-key-form'"
        @manage-ollama="page = 'ollama-manager'"
      />
    </template>
  </div>
</template>

<script lang="ts">
import ApiKeyForm from "./components/ApiKeyForm.vue";
import ChatInterface from "./components/ChatInterface.vue";
import OllamaModelManager from "./components/OllamaModelManager.vue";
import { useChatStore } from "@/stores/chat";
import { useConfigurationStore } from "@/stores/configuration";
import { useInternalDataStore } from "@/stores/internalData";
import { useTabState } from "@/stores/tabState";
import { mapState, mapActions, mapGetters } from "pinia";

export default {
  components: {
    ApiKeyForm,
    ChatInterface,
    OllamaModelManager,
  },

  data() {
    return {
      page: "", // Will be set in mounted based on API key availability
      disabledApiKeyForm: false,
      error: "" as unknown,
      appReady: false,
      showLoading: false,
    };
  },

  async mounted() {
    // Show loading bar after 500ms if not ready
    const loadingTimer = setTimeout(() => {
      this.showLoading = true;
    }, 1000);

    try {
      await this.initialize();
      await this.$nextTick();

      const configuration = useConfigurationStore();
      const apiKey =
        configuration[`providers.${this.lastUsedProviderId}.apiKey`] ?? "";

      // Check if API key exists and auto-navigate to appropriate page
      if (apiKey && this.lastUsedProviderId) {
        try {
          this.page = "chat-interface";
        } catch (e) {
          // If initialization fails, go to API key form
          this.page = "api-key-form";
          this.error = e;
        }
      } else {
        this.page = "api-key-form";
      }
    } finally {
      clearTimeout(loadingTimer);
      this.appReady = true;
    }
  },

  computed: {
    ...mapState(useInternalDataStore, ["lastUsedProviderId"]),
    ...mapState(useTabState, ["messages"]),
    ...mapState(useConfigurationStore, {
      openaiApiKey: "providers.openai.apiKey",
      anthropicApiKey: "providers.anthropic.apiKey",
      googleApiKey: "providers.google.apiKey",
      ollamaHost: "providers.ollama.host",
    }),
    ...mapGetters(useConfigurationStore, ["apiKeyExists"]),
  },

  methods: {
    ...mapActions(useConfigurationStore, ["configure"]),
    ...mapActions(useInternalDataStore, ["setInternal"]),
    ...mapActions(useChatStore, ["initialize"]),
  },
};
</script>
