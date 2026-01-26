<script setup lang="ts">
import { ref } from 'vue'
import { withBase } from 'vitepress'

const tabs = [
  { label: 'Timeline', image: 'screenshots/timeline-dark.png' },
  { label: 'Analytics', image: 'screenshots/analytics-dark.png' },
  { label: 'Reports', image: 'screenshots/reports-dark.png' },
  { label: 'Sessions', image: 'screenshots/session-details-dark.png' },
  { label: 'Settings', image: 'screenshots/settings-dark.png' },
]

const activeTab = ref(0)
</script>

<template>
  <div class="preview-container">
    <div class="preview-tabs">
      <button
        v-for="(tab, i) in tabs"
        :key="tab.label"
        class="preview-tab"
        :class="{ active: activeTab === i }"
        @click="activeTab = i"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="preview-image-wrapper">
      <img
        v-for="(tab, i) in tabs"
        v-show="activeTab === i"
        :key="tab.label"
        :src="withBase(tab.image)"
        :alt="`Traq ${tab.label} view`"
      />
    </div>
  </div>
</template>
